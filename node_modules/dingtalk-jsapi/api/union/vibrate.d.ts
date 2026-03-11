import { ICommonAPIParams } from '../../constant/types';
/**
 * 使用振动功能 请求参数定义
 * @apiName vibrate
 */
export interface IUnionVibrateParams extends ICommonAPIParams {
}
/**
 * 使用振动功能 返回结果定义
 * @apiName vibrate
 */
export interface IUnionVibrateResult {
}
/**
 * 使用振动功能
 * @apiName vibrate
 */
export declare function vibrate$(params: IUnionVibrateParams): Promise<IUnionVibrateResult>;
export default vibrate$;
