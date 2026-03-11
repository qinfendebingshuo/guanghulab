import { ICommonAPIParams } from '../../constant/types';
/**
 * 创建实时音频闪记 请求参数定义
 * @apiName minutesStart
 */
export interface IUnionMinutesStartParams extends ICommonAPIParams {
    scene: string;
}
/**
 * 创建实时音频闪记 返回结果定义
 * @apiName minutesStart
 */
export interface IUnionMinutesStartResult {
    uuid: string;
}
/**
 * 创建实时音频闪记
 * @apiName minutesStart
 */
export declare function minutesStart$(params: IUnionMinutesStartParams): Promise<IUnionMinutesStartResult>;
export default minutesStart$;
