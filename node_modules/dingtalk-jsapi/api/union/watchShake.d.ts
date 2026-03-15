import { ICommonAPIParams } from '../../constant/types';
/**
 * 启动摇一摇 请求参数定义
 * @apiName watchShake
 */
export interface IUnionWatchShakeParams extends ICommonAPIParams {
    frequency: number;
    sensitivity: number;
    callbackDelay: number;
}
/**
 * 启动摇一摇 返回结果定义
 * @apiName watchShake
 */
export interface IUnionWatchShakeResult {
}
/**
 * 启动摇一摇
 * @apiName watchShake
 */
export declare function watchShake$(params: IUnionWatchShakeParams): Promise<IUnionWatchShakeResult>;
export default watchShake$;
