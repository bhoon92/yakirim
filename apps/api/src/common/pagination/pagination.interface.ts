export interface PaginationInterface {
  page: number;
  size: number;
}

export interface PaginationInfoInterface extends PaginationInterface {
  maxPage?: number;
  maxCount?: number;
}

export interface PaginationDataInterface<T> {
  data: T[];
  pagination: PaginationInfoInterface;
}
