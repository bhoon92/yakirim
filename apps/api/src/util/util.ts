import crypto from 'crypto';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
dayjs.extend(duration);

export function arrayToRecord<T>(
  array: T[],
  keyFunction: (obj: T) => string | number = (obj: T) => `${(obj as object).toString()}`
): Record<string, T> {
  const record: Record<string, T> = array.reduce(
    (record: Record<string, T>, data: T) => {
      const key = keyFunction(data);
      record[key] = data;
      return record;
    },
    {} as Record<string, T>
  );

  return record;
}

export function recordToArray<T>(record: Record<string, T>) {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

export function getEncryptPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1, 32, 'sha256').toString('hex');
}

export function sortBy<T extends Record<string, any>>(key: string, order: 'asc' | 'desc' = 'asc') {
  return (a: T, b: T) => {
    const orderValue = order === 'asc' ? 1 : -1;
    if (a[key] < b[key]) {
      return -1 * orderValue;
    }
    if (a[key] > b[key]) {
      return 1 * orderValue;
    }
    return 0;
  };
}

export function convertStringToEnum<T extends string, U extends Record<string, any>>(value: T, enumType: U): U[keyof U] {
  const keys = Object.keys(enumType).filter(key => isNaN(Number(key)));
  const enumValue = keys.find(key => (enumType as any)[key] === value);

  if (enumValue) {
    return (enumType as any)[enumValue];
  }

  throw new Error(`Invalid value "${value}" for enum ${enumType}`);
}

export function extractProperty<T, K extends keyof T>(data: T, propertyNames: K[]): Partial<T> {
  const extractedData: Partial<T> = {};
  propertyNames.map(name => (extractedData[name] = data[name]));

  return extractedData;
}

class DateData<T> {
  private data: T[];

  constructor(d: T | T[]) {
    this.data = Array.isArray(d) ? d : [d];
  }

  getData(): T[] {
    return this.data;
  }
}

export class FilledDatesBuilder<T> {
  private resultMap: Record<string | number, T> = {};
  private dateArray: string[] = [];
  private keyTransformerFn: (date: string) => string | number;
  private fillEmptyDataFn: (date: string) => T;

  static init<T>(dateArray: string[]): FilledDatesBuilder<T> {
    const builder = new FilledDatesBuilder<T>();
    builder.dateArray = dateArray;
    return builder;
  }

  setDateToKeyTransformer(fn: (date: string) => string | number): this {
    this.keyTransformerFn = date => fn(date);
    return this;
  }

  setDateToKeyFormat(test: string): this {
    this.keyTransformerFn = date => dayjs(date).format(test);
    return this;
  }

  fillWithMap(record: Record<string | number, T> = {}): this {
    this.resultMap = record;
    return this;
  }

  fillEmptyData(fillEmptyDataFn: (date: string) => T): this {
    this.fillEmptyDataFn = fillEmptyDataFn;
    return this;
  }

  run(): T[] {
    this.resultMap = this.resultMap || {};
    this.keyTransformerFn = this.keyTransformerFn || (date => date);

    return this.dateArray
      .map(date => {
        const data = this.resultMap[this.keyTransformerFn(date)] || this.fillEmptyDataFn(date);
        return new DateData(data).getData();
      })
      .flat();
  }
}

export function durationToMS(date: string) {
  const match = date.match(/^(\d+)([smhd]|ms)$/) as ['', string, string];
  const num = Number(match[1]);
  const unit = match[2];

  let ms = num;
  switch (unit) {
    case 'd':
      ms *= 24;
    case 'h':
      ms *= 60;
    case 'm':
      ms *= 60;
    case 's':
      ms *= 1000;
    case 'ms':
      return ms;
    default:
      throw new Error();
  }
}

export function fillHours(data: { name: string; value: number }[]): { name: string; value: number }[] {
  const dataMap = new Map(data.map(item => [item.name, item.value]));

  return Array.from({ length: 24 }, (_unused, idx) => ({
    name: idx.toString(),
    value: dataMap.get(idx.toString()) || 0,
  }));
}

export function fillDate(startDate: Date, endDate: Date, data: { name: string; value: number }[]): { name: string; value: number }[] {
  const startDayjs = dayjs(startDate);
  const endDayjs = dayjs(endDate);
  const diff = endDayjs.diff(startDayjs, 'day');

  const dataMap = new Map(data.map(item => [item.name, item.value]));

  return Array.from({ length: diff + 1 }, (_unused, index) => {
    const currentDate = startDayjs.add(index, 'day');
    const dateString = currentDate.format('YYYY-MM-DD');
    return {
      name: dateString,
      value: dataMap.get(dateString) || 0,
    };
  });
}

export function getEncrypt(encryptString: string, secretKey: string): string {
  const keyBuffer = crypto.createHash('sha256').update(secretKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(encryptString, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function getDecrypt(decryptString: string, secretKey: string): string {
  const keyBuffer = crypto.createHash('sha256').update(secretKey).digest();
  const [ivHex, encrypted] = decryptString.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
