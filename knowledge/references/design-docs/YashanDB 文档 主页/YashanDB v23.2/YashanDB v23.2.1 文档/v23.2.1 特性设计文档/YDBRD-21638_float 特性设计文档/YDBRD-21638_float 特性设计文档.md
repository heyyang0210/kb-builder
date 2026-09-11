Created by 袁昊坤, last modified on 十月 15, 2024

#   [YDBRD-21638: float兼容](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [Design](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [(](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)      [float兼容](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

SR链接：       [YDBRD-21638](https://jira.yasdb.com/browse/YDBRD-21638?src=confmacro)    -  ORACLE的语法兼容FLOAT(126)  完成

MR链接：    [feat:YDBRD-21638 ORACLE的语法兼容FLOAT(126) (!27004) · Merge requests · CoD-X / AnchorBase · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/27004)  

  


##   [1. Overview（概述）](#1-overview概述)  

SR描述：ORACLE的语法兼容FLOAT(126)，实际等于崖山中的FLOAT(53)。

规格范围：单机, 分布式, 集群。

##   [2. Features（功能特性）](#2-features功能特性)  

使Yasdb语法兼容Oracle的float(126)。

##   [3. Interfaces（接口）](#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- float精度只支持1~126。
- 当p大于53，小于等于126时系统内部会将p变成53。
- float的p大于23时，系统内部会将其转为double。
- double的精度范围仍保持不变。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

在tryParsePrecision接口中，对本身maxLen > ANS_MAX_DOUBLE_PRECISION 报错的逻辑进行修改。

对float做单独处理，将float的精度上线53修改为126，当大于53小于126时，直接将maxLen修改为53。

当float长度大于23时，系统内部会将其转为double。

###   [5.1 Architecture（架构）](#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c408970c2af4f520a6f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAwNjQsImV4cCI6MTc4MjMxMDg2NH0.Zg3sLVw--vN5DrTiGSXuMeRzQDtWOxK4YRySoFwdnec)

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 主要测试边界值情况。
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[float.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2Y4OTcwYzJhZjRmNTIwYTZkIiwicmVmX2lkIjoiNjczOTZjM2Y3MjgyMDZlZmI5MmYwZjhlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMDYzLCJleHAiOjE3ODIzODY0NjN9.quxEqhjzDV99ayE6vFsIhIeXiHWdNIAGOHacoerRKYU)

 (application/octet-stream)    
