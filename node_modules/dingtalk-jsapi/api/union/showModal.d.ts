import { ICommonAPIParams } from '../../constant/types';
/**
 * 增强版modal弹浮层 请求参数定义
 * @apiName showModal
 */
export interface IUnionShowModalParams extends ICommonAPIParams {
    /** 浮层元素数组，每一个item为一个包含image、title、content内容的对象 */
    cells: Array<{
        /** 图片地址 */
        image: string;
        /** 标题 */
        title: string;
        /** 文本内容 */
        content: string;
    }>;
    /**  最多两个按钮，至少有一个按钮。 */
    buttonLabels: string[];
}
/**
 * 增强版modal弹浮层 返回结果定义
 * @apiName showModal
 */
export interface IUnionShowModalResult {
    buttonIndex: string;
}
/**
 * 增强版modal弹浮层
 * @apiName showModal
 */
export declare function showModal$(params: IUnionShowModalParams): Promise<IUnionShowModalResult>;
export default showModal$;
