export declare const apiName = "biz.contact.teamScaleSelect";
/**
 * 团队规则选择页面 请求参数定义
 * @apiName biz.contact.teamScaleSelect
 */
export interface IBizContactTeamScaleSelectParams {
    /** 当前选中的index ,缺省或者-1，代表没选 */
    selectedIndex?: number;
}
/**
 * 团队规则选择页面 返回结果定义
 * @apiName biz.contact.teamScaleSelect
 */
export interface IBizContactTeamScaleSelectResult {
    /** 当前选中的index ,缺省或者-1，代表没选 */
    selectedIndex?: number;
    /** 选中的规模描述方案，如：1-10 */
    scaleDesc: string;
    /** 选中的规模编码 */
    scaleCode: number;
    /** 选中规模的最小人数 */
    minLimit: number;
}
/**
 * 团队规则选择页面
 * @apiName biz.contact.teamScaleSelect
 * @supportVersion ios: 4.6.37 android: 4.6.37
 */
export declare function teamScaleSelect$(params: IBizContactTeamScaleSelectParams): Promise<IBizContactTeamScaleSelectResult>;
export default teamScaleSelect$;
