import { getSchemaPath } from '@nestjs/swagger';

/**
 * usages
 * @ApiExtraModels(RequestInputCampaignDto, RequestCreateRewardDto, RequestInputCampaignTermDto)
 * @ApiBody({
 *   schema: {
 *     type: 'object',
 *     properties: {
 *       campaign: getSchemaModel(RequestInputCampaignDto) ,
 *       reward: getSchemaModel(RequestCreateRewardDto),
 *       terms: getSchemaModel(RequestInputCampaignTermDto),
 *     }
 *   }
 * })
 */
export function getSchemaModel(model: Function): { $ref: string } {
  return { $ref: getSchemaPath(model) };
}
