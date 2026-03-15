export declare const apiName = "internal.attend.getAccurateLocatingInfo";
/**
 * 考勤精确定位所需数据采集 请求参数定义
 * @apiName internal.attend.getAccurateLocatingInfo
 */
export interface IInternalAttendGetAccurateLocatingInfoParams {
}
/**
 * 考勤精确定位所需数据采集 返回结果定义
 * @apiName internal.attend.getAccurateLocatingInfo
 */
export interface IInternalAttendGetAccurateLocatingInfoResult {
    /**
     * identifierType=1时，为utdid经过两次md5加密后得到的值
     */
    uniqueIdentifier: string;
    /** 目前版本（0106迭代）只存在为1的情况，表示uniqueIdentifier是utdid经过两次md5加密后得到的值 */
    identifierType: number;
    /** mac地址 */
    macAddress: string;
    /** "2g""3g""4g""wifi""other" */
    netWorkType: string;
    /** 经度 */
    longitude: number;
    /** 纬度 */
    latitude: number;
    /** 基站信息列表转json字符串 */
    baseStationList: string;
    /** wifi信息列表转json字符串 */
    wifiSignalModelList: string;
}
/**
 * 考勤精确定位所需数据采集
 * @apiName internal.attend.getAccurateLocatingInfo
 * @supportVersion android: 4.7.24
 * @author Android：序望
 */
export declare function getAccurateLocatingInfo$(params: IInternalAttendGetAccurateLocatingInfoParams): Promise<IInternalAttendGetAccurateLocatingInfoResult>;
export default getAccurateLocatingInfo$;
