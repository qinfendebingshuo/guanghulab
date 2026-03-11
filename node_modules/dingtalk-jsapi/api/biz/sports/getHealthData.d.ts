import { ICommonAPIParams } from '../../../constant/types';
/**
 * 获取指定类型的健康数据 请求参数定义
 * @apiName biz.sports.getHealthData
 */
export interface IBizSportsGetHealthDataParams extends ICommonAPIParams {
    type: number;
    endTime: string;
    startTime: string;
    filterManualInput: boolean;
}
/**
 * 获取指定类型的健康数据 返回结果定义
 * @apiName biz.sports.getHealthData
 */
export interface IBizSportsGetHealthDataResult {
    healthDataList: {
        value: number;
        workout: {
            dataId: string;
            endDate: string;
            duration: string;
            startDate: string;
            avgHeartrate: number;
            maxHeartrate: number;
            totalDistance: number;
            totalEnergyBurned: number;
            workoutActivityType: string;
        };
        timeZone: string;
        lastTimestamp: string;
    }[];
}
/**
 * 获取指定类型的健康数据
 * @apiName biz.sports.getHealthData
 */
export declare function getHealthData$(params: IBizSportsGetHealthDataParams): Promise<IBizSportsGetHealthDataResult>;
export default getHealthData$;
