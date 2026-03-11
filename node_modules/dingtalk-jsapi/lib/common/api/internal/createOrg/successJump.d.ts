export declare const apiName = "internal.createOrg.successJump";
/**
 * 创建团队之后跳转 请求参数定义
 * @apiName internal.createOrg.successJump
 */
export interface IInternalCreateOrgSuccessJumpParams {
    [key: string]: any;
}
/**
 * 创建团队之后跳转 返回结果定义
 * @apiName internal.createOrg.successJump
 */
export interface IInternalCreateOrgSuccessJumpResult {
    [key: string]: any;
}
/**
 * 创建团队之后跳转
 * @apiName internal.createOrg.successJump
 * @supportVersion  ios: 2.9.0 android: 2.9.0
 */
export declare function successJump$(params: IInternalCreateOrgSuccessJumpParams): Promise<IInternalCreateOrgSuccessJumpResult>;
export default successJump$;
