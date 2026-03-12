export declare const apiName = "internal.blebusiness.allOrgs";
/**
 * 获取当前用户的所有企业信息 请求参数定义
 * @apiName internal.blebusiness.allOrgs
 */
export interface IInternalBlebusinessAllOrgsParams {
}
/**
 * 获取当前用户的所有企业信息 返回结果定义
 * @apiName internal.blebusiness.allOrgs
 */
export interface IInternalBlebusinessAllOrgsResult {
    /** DTOrganization数组的JSON字符串 */
    orgInfos: string;
}
/**
 * 获取当前用户的所有企业信息
 * @apiName internal.blebusiness.allOrgs
 * @supportVersion ios: 4.6.18
 */
export declare function allOrgs$(params: IInternalBlebusinessAllOrgsParams): Promise<IInternalBlebusinessAllOrgsResult>;
export default allOrgs$;
