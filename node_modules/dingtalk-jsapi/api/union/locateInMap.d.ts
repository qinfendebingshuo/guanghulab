import { ICommonAPIParams } from '../../constant/types';
/**
 * 地图定位 请求参数定义
 * @apiName locateInMap
 */
export interface IUnionLocateInMapParams extends ICommonAPIParams {
    scope: number;
    latitude?: number;
    longitude?: number;
}
/**
 * 地图定位 返回结果定义
 * @apiName locateInMap
 */
export interface IUnionLocateInMapResult {
    city: string;
    title: string;
    adCode: string;
    adName: string;
    snippet: string;
    cityCode: string;
    distance: string;
    latitude: number;
    postCode: string;
    province: string;
    longitude: string;
    provinceCode: string;
}
/**
 * 地图定位
 * @apiName locateInMap
 */
export declare function locateInMap$(params: IUnionLocateInMapParams): Promise<IUnionLocateInMapResult>;
export default locateInMap$;
