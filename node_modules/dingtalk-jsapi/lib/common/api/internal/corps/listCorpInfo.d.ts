export declare const apiName = "internal.corps.listCorpInfo";
/**
 * 钉钉内部页面使用，获取当前用户本地企业OA数据列表，包含企业名称、别名等 请求参数定义
 * @apiName internal.corps.listCorpInfo
 */
export interface IInternalCorpsListCorpInfoParams {
    [key: string]: any;
}
/**
 * 钉钉内部页面使用，获取当前用户本地企业OA数据列表，包含企业名称、别名等 返回结果定义
 * @apiName internal.corps.listCorpInfo
 */
export interface IInternalCorpsListCorpInfoResult {
    [key: string]: any;
}
/**
 * 钉钉内部页面使用，获取当前用户本地企业OA数据列表，包含企业名称、别名等
 * @apiName internal.corps.listCorpInfo
 * @supportVersion  ios: 4.2.8 android: 4.2.8
 */
export declare function listCorpInfo$(params: IInternalCorpsListCorpInfoParams): Promise<IInternalCorpsListCorpInfoResult>;
export default listCorpInfo$;
