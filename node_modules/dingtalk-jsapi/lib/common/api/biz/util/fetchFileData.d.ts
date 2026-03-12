export declare const apiName = "biz.util.fetchFileData";
/**
 * 获取客户端本地文件二进制数据 请求参数定义
 * @apiName biz.util.fetchFileData
 */
export interface IBizUtilFetchFileDataParams {
    [key: string]: any;
}
/**
 * 获取客户端本地文件二进制数据 返回结果定义
 * @apiName biz.util.fetchFileData
 */
export interface IBizUtilFetchFileDataResult {
    [key: string]: any;
}
/**
 * 获取客户端本地文件二进制数据
 * @apiName biz.util.fetchFileData
 * @supportVersion  ios: 3.4 android: 3.4
 */
export declare function fetchFileData$(params: IBizUtilFetchFileDataParams): Promise<IBizUtilFetchFileDataResult>;
export default fetchFileData$;
