Created by 万谦, last modified on 四月 24, 2023

JIRA：    [https://jira.yasdb.com/browse/YDBRD-14018](https://jira.yasdb.com/browse/YDBRD-14018)  

#   [列存表支持延迟创建segments](#列存表支持延迟创建segments)  

##   [1. Overview（概述）](#1-overview概述)  

适配

  [https://jira.yasdb.com/browse/YDBRD-8179](https://jira.yasdb.com/browse/YDBRD-8179)  

语法中的SEGMENT CREATION列存部分 列存表也支持延迟或立即创建segments能力







##   [2. Features（功能特性）](#2-features功能特性)  

##   [3. Interfaces（接口）](#3-interfaces接口)  

无

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

临时表不支持此语法

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

（1）基本语法

（2）延迟创建基本功能

（3）多种分区都可支持

##   [7. Workload（工作量）](#7-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-4-24_18-43-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmU4OTcwYzJhZjRmNTIwMDgwIiwicmVmX2lkIjoiNjczOTZhZmU1OTNmOTljOWZmMjM1YzJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTM5LCJleHAiOjE3ODIzNzY5Mzl9.dBef4geWFVyRjjx2tFLv4x4uEdjhAVQ9krCyBnnPwqA)

 (image/png)    


[image2023-4-24_18-43-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmU4OTcwYzJhZjRmNTIwMDgxIiwicmVmX2lkIjoiNjczOTZhZmU1OTNmOTljOWZmMjM1YzJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTM5LCJleHAiOjE3ODIzNzY5Mzl9.ISH_u6tM2cGAz8evx181E9GzxopQ6E5hWp1zD2gd0vM)

 (image/png)    


[image2023-4-24_18-45-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmU4OTcwYzJhZjRmNTIwMDgyIiwicmVmX2lkIjoiNjczOTZhZmU1OTNmOTljOWZmMjM1YzJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTM5LCJleHAiOjE3ODIzNzY5Mzl9.M6Z5es3k6e7XXXcXtuLM5BSBGCvgYoWmpAZFHlKc8CI)

 (image/png)    


## Comments:

|  [](null)  ,功能点验证：,1. 在建空表后检查系统表相关segment字段看下是否有值
1. 创建10W分区的速度相比旧版本是否提升（单机、分布式）
,  
,Posted by chenyishun at 四月 25, 2023 10:00|
|---|
