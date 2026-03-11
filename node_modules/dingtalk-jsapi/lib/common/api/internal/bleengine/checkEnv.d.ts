export declare const apiName = "internal.bleengine.checkEnv";
/**
 * 检查蓝牙引擎环境 请求参数定义
 * @apiName internal.bleengine.checkEnv
 */
export interface IInternalBleengineCheckEnvParams {
    [key: string]: any;
}
/**
 * 检查蓝牙引擎环境 返回结果定义
 * @apiName internal.bleengine.checkEnv
 */
export interface IInternalBleengineCheckEnvResult {
    result: boolean;
}
/**
 * 检查蓝牙引擎环境
 * @apiName internal.bleengine.checkEnv
 * @supportVersion ios: 4.6.18
 */
export declare function checkEnv$(params: IInternalBleengineCheckEnvParams): Promise<IInternalBleengineCheckEnvResult>;
export default checkEnv$;
