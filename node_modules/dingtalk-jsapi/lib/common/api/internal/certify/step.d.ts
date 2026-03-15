export declare const apiName = "internal.certify.step";
/**
 * 查询活体认证状态 请求参数定义
 * @apiName internal.certify.step
 */
export interface IInternalCertifyStepParams {
    [key: string]: any;
}
/**
 * 查询活体认证状态 返回结果定义
 * @apiName internal.certify.step
 */
export interface IInternalCertifyStepResult {
    [key: string]: any;
}
/**
 * 查询活体认证状态
 * @apiName internal.certify.step
 * @supportVersion  ios: 2.12.0 android: 2.12.0
 */
export declare function step$(params: IInternalCertifyStepParams): Promise<IInternalCertifyStepResult>;
export default step$;
