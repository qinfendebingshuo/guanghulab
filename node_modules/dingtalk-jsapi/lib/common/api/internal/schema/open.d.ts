export declare const apiName = "internal.schema.open";
/**
 * 内部页面跳转 请求参数定义
 * @apiName internal.schema.open
 */
export interface IInternalSchemaOpenParams {
    [key: string]: any;
}
/**
 * 内部页面跳转 返回结果定义
 * @apiName internal.schema.open
 */
export interface IInternalSchemaOpenResult {
    [key: string]: any;
}
/**
 * 内部页面跳转
 * @apiName internal.schema.open
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function open$(params: IInternalSchemaOpenParams): Promise<IInternalSchemaOpenResult>;
export default open$;
