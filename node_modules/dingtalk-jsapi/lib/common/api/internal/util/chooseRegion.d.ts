export declare const apiName = "internal.util.chooseRegion";
/**
 * 选择地区 请求参数定义
 * @apiName internal.util.chooseRegion
 */
export interface IInternalUtilChooseRegionParams {
    /** 是否需要返回区信息 (4.6.37 新增) */
    needDistrict?: boolean;
    /** 区域信息 */
    region: string;
    [key: string]: any;
}
/**
 * 选择地区 返回结果定义
 * @apiName internal.util.chooseRegion
 */
export interface IInternalUtilChooseRegionResult {
    [key: string]: any;
}
/**
 * 选择地区
 * @apiName internal.util.chooseRegion
 * @supportVersion  ios: 3.5.0 android: 3.5.0
 */
export declare function chooseRegion$(params: IInternalUtilChooseRegionParams): Promise<IInternalUtilChooseRegionResult>;
export default chooseRegion$;
