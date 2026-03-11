export declare const apiName = "internal.util.isSimulator";
/**
 * 模拟器 请求参数定义
 * @apiName internal.util.isSimulator
 */
export interface IInternalUtilIsSimulatorParams {
    [key: string]: any;
}
/**
 * 模拟器 返回结果定义
 * @apiName internal.util.isSimulator
 */
export interface IInternalUtilIsSimulatorResult {
    [key: string]: any;
}
/**
 * 模拟器
 * @apiName internal.util.isSimulator
 * @supportVersion  ios: 2.8.0 android: 2.8.0
 */
export declare function isSimulator$(params: IInternalUtilIsSimulatorParams): Promise<IInternalUtilIsSimulatorResult>;
export default isSimulator$;
