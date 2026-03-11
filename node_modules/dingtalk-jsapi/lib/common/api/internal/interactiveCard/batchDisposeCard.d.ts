export declare const apiName = "internal.interactiveCard.batchDisposeCard";
/**
 * 批量销毁交互动态卡片 请求参数定义
 * @apiName internal.interactiveCard.batchDisposeCard
 */
export interface IInternalInteractiveCardBatchDisposeCardParams {
    /** 交互动态卡片Id列表 */
    cardInstanceIds: number[];
}
/**
 * 批量销毁交互动态卡片 返回结果定义
 * @apiName internal.interactiveCard.batchDisposeCard
 */
export interface IInternalInteractiveCardBatchDisposeCardResult {
}
/**
 * 批量销毁交互动态卡片
 * @apiName internal.interactiveCard.batchDisposeCard
 * @supportVersion ios: 4.7.8 android: 4.7.8
 * @author android: 卧岩, iOS: 鱼非
 */
export declare function batchDisposeCard$(params: IInternalInteractiveCardBatchDisposeCardParams): Promise<IInternalInteractiveCardBatchDisposeCardResult>;
export default batchDisposeCard$;
