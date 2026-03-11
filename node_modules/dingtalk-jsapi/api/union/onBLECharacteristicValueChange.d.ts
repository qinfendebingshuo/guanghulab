/**
 * 监听特征值变化事件 请求参数定义
 */
export declare type IUnionOnBLECharacteristicValueChangeParams = (e: IUnionOnBLECharacteristicValueChangeResult) => void;
/**
 * 监听特征值变化事件 返回结果定义
 */
export interface IUnionOnBLECharacteristicValueChangeResult {
    value: string;
    deviceId: string;
    serviceId: string;
    characteristicId: string;
}
/**
 * 监听特征值变化事件
 * @apiName onBLECharacteristicValueChange
 */
export declare function onBLECharacteristicValueChange$(params: IUnionOnBLECharacteristicValueChangeParams): void;
export default onBLECharacteristicValueChange$;
