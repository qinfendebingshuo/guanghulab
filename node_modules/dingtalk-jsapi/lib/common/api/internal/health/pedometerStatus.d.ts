export declare const apiName = "internal.health.pedometerStatus";
/**
 * 获取 Pedometer （运动与健身）权限状态 请求参数定义
 * @apiName internal.health.pedometerStatus
 */
export interface IInternalHealthPedometerStatusParams {
}
/**
 * 获取 Pedometer （运动与健身）权限状态 返回结果定义
 * @apiName internal.health.pedometerStatus
 */
export interface IInternalHealthPedometerStatusResult {
    /** 0: 未申请 1: 系统限制 2: 用户拒绝 3: 已授权 */
    status: number;
}
/**
 * 获取 Pedometer （运动与健身）权限状态
 * @apiName internal.health.pedometerStatus
 * @supportVersion ios: 4.6.21 android: 4.6.21
 */
export declare function pedometerStatus$(params: IInternalHealthPedometerStatusParams): Promise<IInternalHealthPedometerStatusResult>;
export default pedometerStatus$;
