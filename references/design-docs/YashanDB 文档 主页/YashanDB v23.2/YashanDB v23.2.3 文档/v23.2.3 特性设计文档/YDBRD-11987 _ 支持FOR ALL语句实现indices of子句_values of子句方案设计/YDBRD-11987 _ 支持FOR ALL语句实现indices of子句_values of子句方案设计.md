Created by 谭思宇, last modified on 四月 22, 2024

*SR链接：*    [支持FOR ALL语句实现indicess of子句](https://pingcode.yasdb.com/pjm/items/661102e4579a3edb84d4a9e0? #YDBRD-11987 支持FOR ALL语句实现indicess of子句)  

##   [1. 总述](#1-总述)  

需求范围：实现PLSQL for all循环语法中的indices of子句

###   [1.1 需求来源](#11-需求来源)  

在使用稀疏数组的场景下，使用indices of可以直接读取到索引为非连续的数组，此时只需要通过该子句就可以直接访问对应成员，不需要知道数组索引的上下限。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|支持indices of|见下方|是|是|
|功能|支持indices of between|见下方|是|是|
|功能|支持values of|见下方|是|是|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|见下方语法分支描述|----|是|
|函数|参数/返回值描述|----|否|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


语法分支描述：

![](https://pingcode.yasdb.com/atlas/files/public/67396d448970c2af4f5211a6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBRUFJQUFFQUlBQUFBQUFBQUFBRUFBZ0FBQUFBQUFRQUFBQUFBQUFBRUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUNBQUJJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFRQUFCQUFBQUFBQUFBQWdBSUFBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY5ODIsImV4cCI6MTc4MjMxNzc4Mn0.NEX2oCTVeBFOMCWVw_3uU04XaW9y932Rw1NAFPTqHi4)

![](https://pingcode.yasdb.com/atlas/files/public/67396d44a1ad9a3311dc9018/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBRUFJQUFFQUlBQUFBQUFBQUFBRUFBZ0FBQUFBQUFRQUFBQUFBQUFBRUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUNBQUJJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFRQUFCQUFBQUFBQUFBQWdBSUFBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY5ODIsImV4cCI6MTc4MjMxNzc4Mn0.NEX2oCTVeBFOMCWVw_3uU04XaW9y932Rw1NAFPTqHi4)

##   [3. 规格与约束](#3-规格与约束)  

###   [3.1 INDICES OF 规格约束](#31-indices-of-规格约束)  

###   [collection](#collection)  

仅允许由整形索引的集合类型PLSQL变量（VARRAY或TABLE）

###   [lower_bound/upper_bound](#lower-boundupper-bound)  

可隐式转换为整形的标量表达式，上下限为Int32

###   [3.2 VALUES OF 规格约束](#32-values-of-规格约束)  

###   [collection](#collection-1)  

仅允许  **非稀疏索引**  的集合类型PLSQL变量（定义中不包含INDEX BY的VARRAY或TABLE）

##   [4. 特性](#4-特性)  

场景描述：

|分支|语法分支|取值|表现|
|---|---|---|---|
|  
,INDICES OF,  
,  
,  
,  
|collection    
    
    
    
|已初始化的varray变量或,table变量|正常执行|
|||非集合类型变量|报错数据类型错误|
|||非PLSQL变量|报错非PLSQL变量|
|||未初始化的集合类型变量|报错未初始化|
|||由非整形索引的集合类型|报错不支持非整形索引（不能隐式转换）|
||between|拼写错误|报错非法关键字|
||and|||
||bound    
    
    
    
    
,  
,  
,  
|整形变量或常量|正常执行|
|||超出int32上/下限|报错|
|||lower > high|正常执行，循环0次|
|||lower或high任一为空|正常执行，循环0次|
|||lower > array.last|正常执行，循环0次|
|||lower < array.first,&,upper > array.last|正常执行，循环array.count次|
|||array.first < lower < upper < array.last|正常执行，若array(lower)存在，则从lower开始，否则从array.next(lower)开始,若array(upper)存在，则到upper为止，否则到array.next(upper) > upper为止|
|VALUES OF|collection|已初始化的varray变量或,table变量|正常执行|
|||非集合类型变量|报错数据类型错误|
|||非PLSQL变量|报错非PLSQL变量|
|||未初始化的集合类型变量|报错未初始化|
|||定义中含index by索引的集合类型|报错不支持index by索引（与Oracle有所区别，Oracle报错not collection type）|


###   [4.1 compile流程](#41-compile流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d44a1ad9a3311dc9019/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBRUFJQUFFQUlBQUFBQUFBQUFBRUFBZ0FBQUFBQUFRQUFBQUFBQUFBRUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUNBQUJJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFRQUFCQUFBQUFBQUFBQWdBSUFBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY5ODIsImV4cCI6MTc4MjMxNzc4Mn0.NEX2oCTVeBFOMCWVw_3uU04XaW9y932Rw1NAFPTqHi4)

###   [4.2 verify流程](#42-verify流程)  

流程图略，实际校验几个表达式是否满足“规格与约束”部分限制

###   [4.3 exec流程](#43-exec流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d448970c2af4f5211a7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBRUFJQUFFQUlBQUFBQUFBQUFBRUFBZ0FBQUFBQUFRQUFBQUFBQUFBRUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUNBQUJJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFRQUFCQUFBQUFBQUFBQWdBSUFBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY5ODIsImV4cCI6MTc4MjMxNzc4Mn0.NEX2oCTVeBFOMCWVw_3uU04XaW9y932Rw1NAFPTqHi4)

后续for循环执行过程中每次从 i++ 变成 i = array.next(i)即可

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

参考场景描述中的分支

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

## Comments:

|  [](null)  ,会议纪要,参会人员：谭思宇 廖峰 郝鑫刚 曾思尹 张欣 党文琪 李浩勇,会议内容,1. 确认Oracle在values of场景对于index by的详细限制（已确认支持PLS_INTEGER）
1. collection成分暂不支持传入绑定参数
1. 转测与index by联调后同一包转测
,Posted by tansiyu at 四月 24, 2024 11:41|
|---|
