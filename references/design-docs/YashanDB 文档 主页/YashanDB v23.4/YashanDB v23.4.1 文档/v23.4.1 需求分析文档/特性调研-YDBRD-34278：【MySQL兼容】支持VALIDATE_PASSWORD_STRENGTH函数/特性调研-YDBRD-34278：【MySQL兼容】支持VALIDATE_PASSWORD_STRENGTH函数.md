Created by 邓秋怡, last modified on 十月 30, 2024

  


IR链接：    [YASHAN-3167](https://pingcode.yasdb.com/ship/ideas/66cc248b89f961f3300fd34c?#YASHAN-3167)      
  SR链接：    [YDBRD-34278](https://pingcode.yasdb.com/pjm/items/670e4b77e489dd0868f7f6d1?#YDBRD-34278)    设计文档：    [VALIDATE_PASSWORD_STRENGTH函数设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=171076451)  

##   [1. Overview（概述）](#1-overview概述)  

  [MYSQL 5.7 VALIDATE_PASSWORD_STRENGTH函数文档](https://dev.mysql.com/doc/refman/5.7/en/encryption-functions.html#function_validate-password-strength)  

函数的语法、功能调研基于MYSQL 5.7。

##   [2. Features（功能特性）](#2-features功能特性)  

(1) 功能按等价类划分子特性，将每个子特性对应的输出行为，尝试进行行为解释说明。等价类划分要证明全面。

|功能|调研表现|
|---|---|
|VALIDATE_PASSWORD_STRENGTH|给定一个代表明文密码的参数后，该函数返回一个整数来表示密码的强度。返回值范围从 0（弱）到 100（强）。|


(2) 函数或者表达式特性调研，必须给出不同参数组合情况下，功能特性的表现情况。同时因为与数据类型相关，要组合不同数据类型入参下，计划和执行阶段出参的类型。

- **VALIDATE_PASSWORD_STRENGTH(STR)**


|参数1|调研表现|补充说明|
|---|---|---|
|字符串参数str|明文密码||


VALIDATE_PASSWORD_STRENGTH依赖validate_password插件实现，插件变量如下：

|变量名|变量含义|是否影响函数结果|
|:---|:---|:---|
|  [](https://dev.mysql.com/doc/refman/8.4/en/validate-password-options-variables.html#sysvar_validate_password.changed_characters_percentage)  |每次修改密码至少要修改的百分比|否|
|  [](https://dev.mysql.com/doc/refman/8.4/en/validate-password-options-variables.html#sysvar_validate_password.check_user_name)  |是否将密码与当前会话的有效用户帐户的用户名部分进行比较，如果匹配则拒绝接受|是|
|  [](https://dev.mysql.com/doc/refman/8.4/en/validate-password-options-variables.html#sysvar_validate_password.dictionary_file)  |参数用于指定一个文件路径，该文件包含不允许作为密码的一部分的词汇列表|是|
|  [](https://dev.mysql.com/doc/refman/8.4/en/validate-password-options-variables.html#sysvar_validate_password.length)  |最小长度|是|
|  [](https://dev.mysql.com/doc/refman/8.4/en/validate-password-options-variables.html#sysvar_validate_password.mixed_case_count)  |规定了密码中至少需要包含多少个大写字母和多少个小写字母|是|
|  [](https://dev.mysql.com/doc/refman/8.4/en/validate-password-options-variables.html#sysvar_validate_password.number_count)  |密码中必须包含的最小数字数量|是|
|  [](https://dev.mysql.com/doc/refman/8.4/en/validate-password-options-variables.html#sysvar_validate_password.policy)  |validate_password 执行的密码策略    `0`       or       `LOW`    /  1     or     MEDIUM/2     or     STRONG|否|
|  [](https://dev.mysql.com/doc/refman/8.4/en/validate-password-options-variables.html#sysvar_validate_password.special_char_count)  |必须包含的最小特殊字符数量|是|
|  
|  
|  
|
|  
|  
|  
|


![](https://conf.yasdb.com/download/attachments/171072574/image2024-10-22_16-5-52.png?version=1&modificationDate=1729584353000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUyMTksImV4cCI6MTc4MjQ2NjAxOX0.MX6-EjsXRylOD21fl7VZSKI_IU604mJTNb3ENzONEBA)

- LOW 策略：只测试密码长度。密码长度必须至少为 8 个字符。要更改长度，请修改 validate_password_length。
- MEDIUM策略：增加了密码必须至少包含 1 个数字字符、1 个小写字符、1 个大写字符和 1 个特殊（非数字）字符的条件。要更改这些值，请修改 validate_password_number_count、validate_password_mixed_case_count 和 validate_password_special_char_count。
- STRONG 策略：增加了一个条件，即长度为 4 或更长的密码子串必须与字典文件中的单词不匹配（如果指定了字典文件）。要指定字典文件，请修改 validate_password_dictionary_file。


特殊：

- 如果启用了 validate_password_check_user_name 系统变量，且密码与用户名正向或反向匹配，则无论其他 validate_password 系统变量如何设置，VALIDATE_PASSWORD_STRENGTH() 都会返回 0。
- 文件字典匹配规则：sql语句中的密码，转成小写和文件进行对比，文件中的密码不做大小写转换。详细见文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=171076071](https://conf.yasdb.com/pages/viewpage.action?pageId=171076071)  


(3) SQL语法有关的功能特性调研，需要给出语法图或EBNF，说明各语法分支的具体含义。

|功能|调研表现|调研表现|
|---|---|---|
|语法分支1|用例输出行为|行为解释说明|
|语法分支2|用例输出行为|行为解释说明|


(4) 与协议、通讯、多线程多进程同步有关的功能特性调研，需要给出时序图。

(5) 调研数据库的功能相关的系统表、系统视图和配置参数，需要罗列，给出原始资料链接和概括小结。

(6) 偏内层，无法直接感知的功能特性，要从explain、视图、DFX函数、用户文档以及相关功能的表现，进行多方佐证。

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

说明整个特性或子特性，在对应数据库下，调研得到的功能限制或约束。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*