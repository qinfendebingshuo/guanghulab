import { ICommonAPIParams } from '../../constant/types';
/**
 * 视频转闪记 请求参数定义
 * @apiName minutesCreateFromVideo
 */
export interface IUnionMinutesCreateFromVideoParams extends ICommonAPIParams {
    title: string;
    videoId: string;
    pushMinutesCard: boolean;
}
/**
 * 视频转闪记 返回结果定义
 * @apiName minutesCreateFromVideo
 */
export interface IUnionMinutesCreateFromVideoResult {
    uuid: string;
}
/**
 * 视频转闪记
 * @apiName minutesCreateFromVideo
 */
export declare function minutesCreateFromVideo$(params: IUnionMinutesCreateFromVideoParams): Promise<IUnionMinutesCreateFromVideoResult>;
export default minutesCreateFromVideo$;
