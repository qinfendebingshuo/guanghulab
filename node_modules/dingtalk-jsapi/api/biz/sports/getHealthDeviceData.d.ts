import { ICommonAPIParams } from '../../../constant/types';
/**
 * 获取健康数据所在设备信息 请求参数定义
 * @apiName biz.sports.getHealthDeviceData
 */
export interface IBizSportsGetHealthDeviceDataParams extends ICommonAPIParams {
}
/**
 * 获取健康数据所在设备信息 返回结果定义
 * @apiName biz.sports.getHealthDeviceData
 */
export interface IBizSportsGetHealthDeviceDataResult {
    channel: string;
    deviceId: string;
}
/**
 * 获取健康数据所在设备信息
 * @apiName biz.sports.getHealthDeviceData
 */
export declare function getHealthDeviceData$(params: IBizSportsGetHealthDeviceDataParams): Promise<IBizSportsGetHealthDeviceDataResult>;
export default getHealthDeviceData$;
