export declare const apiName = "device.geolocation.checkService";
/**
 * 检查定位服务类型（仅Android） 请求参数定义
 * @apiName device.geolocation.checkService
 */
export interface IDeviceGeolocationCheckServiceParams {
    [key: string]: any;
}
/**
 * 检查定位服务类型（仅Android） 返回结果定义
 * @apiName device.geolocation.checkService
 */
export interface IDeviceGeolocationCheckServiceResult {
    /** 定位服务类型： 1: 定位服务关闭 2: 仅限设备(gps) 4: 低耗电量(wifi) 8: 高精确度(gps+wifi) */
    serviceType: number;
}
/**
 * 检查定位服务类型（仅Android）
 * @apiName device.geolocation.checkService
 * @supportVersion ios: 4.6.3
 * @author Android：序望
 */
export declare function checkService$(params: IDeviceGeolocationCheckServiceParams): Promise<IDeviceGeolocationCheckServiceResult>;
export default checkService$;
