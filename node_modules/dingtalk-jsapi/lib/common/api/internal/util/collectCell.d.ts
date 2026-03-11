export declare const apiName = "internal.util.collectCell";
/**
 * 安卓收集打卡瞬间用户周围的基站情况 请求参数定义
 * @apiName internal.util.collectCell
 */
export interface IInternalUtilCollectCellParams {
    [key: string]: any;
}
/**
 * 安卓收集打卡瞬间用户周围的基站情况 返回结果定义
 * @apiName internal.util.collectCell
 */
export interface IInternalUtilCollectCellResult {
    [key: string]: any;
}
/**
 * 安卓收集打卡瞬间用户周围的基站情况
 * @apiName internal.util.collectCell
 * @supportVersion  android: 3.5.1
 */
export declare function collectCell$(params: IInternalUtilCollectCellParams): Promise<IInternalUtilCollectCellResult>;
export default collectCell$;
