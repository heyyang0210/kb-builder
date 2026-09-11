Created by 朱月婷 on 五月 14, 2024

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66290f05fd997db58ae12907](https://pingcode.yasdb.com/pjm/items/66290f05fd997db58ae12907)    *?*  *  
*  *#YDBRD-26658 insert on duplicate update支持values(column)功能*

##   [1. 总述](#1-总述)  

支持insert on duplicate update支持values(column)功能。

使用方式：insert into t_1 (a,b,c) values (1,2,3) on duplicate key update a=values(a),b=values(b),c=values(c);

其中values(column)的值为values (1,2,3)对应的字段值。

###   [1.1 需求来源](#11-需求来源)  

地铁云管平台

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=152999077](https://conf.yasdb.com/pages/viewpage.action?pageId=152999077)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|update c1=values(c2)|下方展开|是|是|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|update col1 = values(col2)|----|是|


##   [3. 规格与约束](#3-规格与约束)  

暂无

##   [4. 特性](#4-特性)  

parse阶段：过滤values关键字（通过addVariantWord时，对ANL_TOKEN_VALUES特殊处理），仅记下columnName；

在anlParser上新增allowValues参数，如果其他地方出现调用values(c1)的情况，报错。

verify阶段：校验column是否在Aclause中出现，如果出现，记下对应的位置，否则置NULL。

exec阶段：增加标志位，如果是values的形式，根据对应的id取到Aclause的值，构造updateInfo进行更新。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 分区表
1. c1=c2, c1=values(c2)叠加使用
1. 异常场景测试4.打印的rowCount是否和mysql一致5.不影响存量用例6.insert多行，更新后存在冲突场景


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。