import { ICommonAPIParams } from '../../constant/types';
/**
 * 设置读特征通知模式 请求参数定义
 * @apiName notifyBLECharacteristicValueChange
 */
export interface IUnionNotifyBLECharacteristicValueChangeParams extends ICommonAPIParams {
    state?: boolean;
    deviceId: string;
    serviceId: string;
    descriptorId?: string;
    characteristicId: string;
}
/**
 * 设置读特征通知模式 返回结果定义
 * @apiName notifyBLECharacteristicValueChange
 */
export interface IUnionNotifyBLECharacteristicValueChangeResult {
}
/**
 * 设置读特征通知模式
 * @apiName notifyBLECharacteristicValueChange
 */
export declare function notifyBLECharacteristicValueChange$(params: IUnionNotifyBLECharacteristicValueChangeParams): Promise<IUnionNotifyBLECharacteristicValueChangeResult>;
export default notifyBLECharacteristicValueChange$;
