import { ICommonAPIParams } from '../../constant/types';
/**
 * 停止连续定位 请求参数定义
 * @apiName stopLocating
 */
export interface IUnionStopLocatingParams extends ICommonAPIParams {
    sceneId: string;
}
/**
 * 停止连续定位 返回结果定义
 * @apiName stopLocating
 */
export interface IUnionStopLocatingResult {
    sceneId: string;
}
/**
 * 停止连续定位
 * @apiName stopLocating
 */
export declare function stopLocating$(params: IUnionStopLocatingParams): Promise<IUnionStopLocatingResult>;
export default stopLocating$;
