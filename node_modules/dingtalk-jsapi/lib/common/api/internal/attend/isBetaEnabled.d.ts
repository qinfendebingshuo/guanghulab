export declare const apiName = "internal.attend.isBetaEnabled";
/**
 * 按照module、key，查询DTLemon的客户端开关值 请求参数定义
 * @apiName internal.attend.isBetaEnabled
 */
export interface IInternalAttendIsBetaEnabledParams {
    /** 开关所属的模块 */
    module: string;
    /** 开关的key名 */
    key: string;
}
/**
 * 按照module、key，查询DTLemon的客户端开关值 返回结果定义
 * @apiName internal.attend.isBetaEnabled
 */
export interface IInternalAttendIsBetaEnabledResult {
    /** 开关开启情况 */
    isBetaEnable: boolean;
}
/**
 * 按照module、key，查询DTLemon的客户端开关值
 * @apiName internal.attend.isBetaEnabled
 * @supportVersion ios: 4.5.5 android: 4.5.5
 */
export declare function isBetaEnabled$(params: IInternalAttendIsBetaEnabledParams): Promise<IInternalAttendIsBetaEnabledResult>;
export default isBetaEnabled$;
