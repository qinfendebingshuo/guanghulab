export declare const apiName = "internal.util.chooseIndustry";
/**
 * 选择行业组件 请求参数定义
 * @apiName internal.util.chooseIndustry
 */
export interface IInternalUtilChooseIndustryParams {
    [key: string]: any;
}
/**
 * 选择行业组件 返回结果定义
 * @apiName internal.util.chooseIndustry
 */
export interface IInternalUtilChooseIndustryResult {
    [key: string]: any;
}
/**
 * 选择行业组件
 * @apiName internal.util.chooseIndustry
 * @supportVersion  ios: 3.5.0 android: 3.5.0
 */
export declare function chooseIndustry$(params: IInternalUtilChooseIndustryParams): Promise<IInternalUtilChooseIndustryResult>;
export default chooseIndustry$;
