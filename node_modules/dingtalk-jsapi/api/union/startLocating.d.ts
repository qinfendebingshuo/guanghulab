import { ICommonAPIParams } from '../../constant/types';
/**
 * 连续获取当前地理位置信息（持续定位） 请求参数定义
 * @apiName startLocating
 */
export interface IUnionStartLocatingParams extends ICommonAPIParams {
    sceneId: string;
    useCache: boolean;
    withReGeocode: boolean;
    targetAccuracy: number;
    callBackInterval: number;
    iOSDistanceFilter: number;
}
/**
 * 连续获取当前地理位置信息（持续定位） 返回结果定义
 * @apiName startLocating
 */
export interface IUnionStartLocatingResult {
    city: string;
    road: string;
    address: string;
    netType: string;
    accuracy: number;
    district: string;
    latitude: number;
    provider: string;
    province: string;
    errorCode: number;
    longitude: number;
    isFromMock: boolean;
    errorMessage: string;
    isGpsEnabled: boolean;
    locationType: number;
    operatorType: string;
    isWifiEnabled: boolean;
    isMobileEnabled: boolean;
}
/**
 * 连续获取当前地理位置信息（持续定位）
 * @apiName startLocating
 */
export declare function startLocating$(params: IUnionStartLocatingParams): Promise<IUnionStartLocatingResult>;
export default startLocating$;
