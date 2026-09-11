Created by 李嘉瑞, last modified by  林博 on 一月 22, 2024

IR链接：    [YDBRD-10019](https://jira.yasdb.com/browse/YDBRD-10019?src=confmacro)    -  [列存计算支持] 列存索引扫描适配降序索引  完成  / SR链接：    [YDBRD-10021](https://jira.yasdb.com/browse/YDBRD-10021?src=confmacro)    -  [列存计算支持] 列存索引扫描适配降序索引  完成

##   [1. Overview（概述）](#1-overview概述)  

- 列执行索引扫描支持对降序索引的扫描


##   [2. Features（功能特性）](#2-features功能特性)  

- 降序索引创建举例：
- 创建降序索引需要在列名后指定降序(desc)，代表该列数据存储时按照降序方式排序


```
create index index_name on table_name(column_name desc);

```

##   [3. Interfaces（接口）](#3-interfaces接口)  

- 适配方案暂无接口


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 不支持函数索引


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

- 降序索引的主要适配工作在于对range的处理。需要根据是否降序对range进行升序/降序排序，同时降序列需要交换range的左值和右值。


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 索引扫描类型： index full scan, index range scan, index scan min/max, index skip scan, index fast full scan, index unique scan
- 部分列降序和部分列升序混合
- 索引正向扫描和反向扫描


自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

不涉及资料内容修改

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-4-14_10-52-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZGE4OTcwYzJhZjRmNTFmZjlmIiwicmVmX2lkIjoiNjczOTZhZDk1OTNmOTljOWZmMjM1YWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NDk5LCJleHAiOjE3ODIzNzU4OTl9.WduEsGdasoDZViP9_ABMOy0DLHbjKYprofE5tLO15o8)

 (image/png)    


[image2023-4-14_10-55-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZGFhMWFkOWEzMzExZGM3ZTE2IiwicmVmX2lkIjoiNjczOTZhZDk1OTNmOTljOWZmMjM1YWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NDk5LCJleHAiOjE3ODIzNzU4OTl9.4MgbiN0OI5n9Wa6ycstHUBmxPyoYDca27ftjI5P6YUY)

 (image/png)    
