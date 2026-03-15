import { ICommonAPIParams } from '../../constant/types';
/**
 * 停止摇一摇 请求参数定义
 * @apiName clearShake
 */
export interface IUnionClearShakeParams extends ICommonAPIParams {
}
/**
 * 停止摇一摇 返回结果定义
 * @apiName clearShake
 */
export interface IUnionClearShakeResult {
}
/**
 * 停止摇一摇
 * @apiName clearShake
 */
export declare function clearShake$(params: IUnionClearShakeParams): Promise<IUnionClearShakeResult>;
export default clearShake$;
