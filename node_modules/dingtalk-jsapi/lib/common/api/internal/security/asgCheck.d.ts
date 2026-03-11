export declare const apiName = "internal.security.asgCheck";
/**
 * internal.security.asgCheck 请求参数定义
 * @apiName internal.security.asgCheck
 */
export interface IInternalSecurityAsgCheckParams {
}
/**
 * internal.security.asgCheck 返回结果定义
 * @apiName internal.security.asgCheck
 */
export interface IInternalSecurityAsgCheckResult {
    /** 检测设备环境 */
    methodDE: string;
    /** 检测应用运行环境 */
    methodDM: string;
    /** 检测是否存在模拟点击service */
    methodDAType0: string;
    /** 检测是否存在模拟输入法 */
    methodDAType1: string;
    /** 检测是否存在模拟地理位置篡改app */
    methodDL: string;
}
/**
 * internal.security.asgCheck
 * @apiName internal.security.asgCheck
 * @supportVersion android: 4.3.7
 */
export declare function asgCheck$(params: IInternalSecurityAsgCheckParams): Promise<IInternalSecurityAsgCheckResult>;
export default asgCheck$;
