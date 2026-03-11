export declare const apiName = "biz.cspace.copy";
/**
 * 将钉盘系统内文件拷贝到钉盘内指定位置 请求参数定义
 * @apiName biz.cspace.copy
 */
export interface IBizCspaceCopyParams {
    [key: string]: any;
}
/**
 * 将钉盘系统内文件拷贝到钉盘内指定位置 返回结果定义
 * @apiName biz.cspace.copy
 */
export interface IBizCspaceCopyResult {
    [key: string]: any;
}
/**
 * 将钉盘系统内文件拷贝到钉盘内指定位置
 * @apiName biz.cspace.copy
 * @supportVersion  ios: 3.5.0 android: 3.5.0
 */
export declare function copy$(params: IBizCspaceCopyParams): Promise<IBizCspaceCopyResult>;
export default copy$;
