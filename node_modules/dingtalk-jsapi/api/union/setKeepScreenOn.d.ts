import { ICommonAPIParams } from '../../constant/types';
/**
 * 设置屏幕常亮 请求参数定义
 * @apiName setKeepScreenOn
 */
export interface IUnionSetKeepScreenOnParams extends ICommonAPIParams {
    isKeep: boolean;
}
/**
 * 设置屏幕常亮 返回结果定义
 * @apiName setKeepScreenOn
 */
export interface IUnionSetKeepScreenOnResult {
}
/**
 * 设置屏幕常亮
 * @apiName setKeepScreenOn
 */
export declare function setKeepScreenOn$(params: IUnionSetKeepScreenOnParams): Promise<IUnionSetKeepScreenOnResult>;
export default setKeepScreenOn$;
