import { ICommonAPIParams } from '../../../constant/types';
/**
 * 打开地区选择器 请求参数定义
 * @apiName biz.util.chooseRegion
 */
export interface IBizUtilChooseRegionParams extends ICommonAPIParams {
    selectedCode?: string;
}
/**
 * 打开地区选择器 返回结果定义
 * @apiName biz.util.chooseRegion
 */
export interface IBizUtilChooseRegionResult {
    region?: string;
    regionCode: string;
    regionName: string;
    regionFullName: string;
}
/**
 * 打开地区选择器
 * @apiName biz.util.chooseRegion
 */
export declare function chooseRegion$(params: IBizUtilChooseRegionParams): Promise<IBizUtilChooseRegionResult>;
export default chooseRegion$;
