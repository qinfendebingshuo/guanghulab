export declare const apiName = "internal.util.getLBSWua";
/**
 * 获取安全lbstoken 请求参数定义
 * @apiName internal.util.getLBSWua
 */
export interface IInternalUtilGetLBSWuaParams {
}
/**
 * 获取安全lbstoken 返回结果定义
 * @apiName internal.util.getLBSWua
 */
export interface IInternalUtilGetLBSWuaResult {
    lbsWua: string;
}
/**
 * 获取安全lbstoken
 * @apiName internal.util.getLBSWua
 * @supportVersion ios: 4.6.34 android: 4.6.33
 * @author andriod：叔敖, ios：小僧
 */
export declare function getLBSWua$(params: IInternalUtilGetLBSWuaParams): Promise<IInternalUtilGetLBSWuaResult>;
export default getLBSWua$;
