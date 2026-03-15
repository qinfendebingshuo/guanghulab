export declare const apiName = "internal.util.dns";
/**
 * dns解析 请求参数定义
 * @apiName internal.util.dns
 */
export interface IInternalUtilDnsParams {
    host: string;
}
/**
 * dns解析 返回结果定义
 * @apiName internal.util.dns
 */
export declare type IInternalUtilDnsResult = string[];
/**
 * dns解析
 * @apiName internal.util.dns
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function dns$(params: IInternalUtilDnsParams): Promise<IInternalUtilDnsResult>;
export default dns$;
