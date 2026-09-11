Created by 邓秋怡, last modified on 十一月 11, 2024

IR链接：  [YASHAN-3047](https://pingcode.yasdb.com/ship/ideas/66c5b23b4283cf23d4f37342?)    
SR链接：  [YDBRD-34027](https://pingcode.yasdb.com/pjm/items/670e3b98e489dd0868f7e50e?)  

#   [1. Overview（概述）](#1-overview概述)  

函数的语法、功能调研基于MYSQL 5.7。

#   [2. Features（功能特性）](#2-features功能特性)  

(1) 功能按等价类划分子特性，将每个子特性对应的输出行为，尝试进行行为解释说明。等价类划分要证明全面。

|功能|调研表现|
|---|---|
|CONCAT|CONCAT返回字符串拼接结果|
|CONCAT_WS|CONCAT_WS返回字符串通过指定分隔符拼接的结果|
|||


(2) 函数或者表达式特性调研，必须给出不同参数组合情况下，功能特性的表现情况。同时因为与数据类型相关，要组合不同数据类型入参下，计划和执行阶段出参的类型。

##   [2.1 CONCAT](#21-lcase)  

###   [2.1.1 功能点1：语法](#211-功能点1语法)  

CONCAT(str1,str2,...)：

- CONCAT返回参数连接后的字符串。可以有一个或多个参数。


###   [2.1.2 功能点2：参数规格](#212-功能点2参数规格)  

|参数|参数类型|参数说明|
|---|---|---|
|strN|能够转字符类型的所有类型||


###   [2.1.3 需求详细描述](#213-需求详细描述)  

### 类型

- 如果所有参数都是非二进制字符串，则结果为非二进制字符串。
- 如果参数中包含二进制字符串（bit执行时等价于二进制），则结果为二进制字符串。


![image.png](https://pingcode.yasdb.com/atlas/files/public/676a90dda1ad9a3311de5695/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQ0FBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUJBQWdBQUFBQUFBQUVBQUFBQUFBQVFBQUFBQUVBQUFBQUFBQUFBQUJJQUFBQUNBQUFBQUFBQUFBQUFBQUFRQUFJQUFBQUFBQUFBQUFFQUFBZ0FBQUFBQUFBQUFRRUFRQUFBQUFCQUFBQUFBQUFBQUFBQUFBQkFBQVFBQUlBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxMDYsImV4cCI6MTc4MjQ2NjkwNn0.PCu57f2a9M3DEOkBJfD-6cLxMb-jg67AEVgd9oq-CzI)

- 数字参数将转换为等价的非二进制字符串形式。


### NULL

- 如果任何参数为 NULL，则 CONCAT() 返回 NULL。


### 长度

### 参数个数

### 特殊用例1：（mysql预估类型长度不够）

![clipbord_1735027702373.png](https://pingcode.yasdb.com/atlas/files/public/676a7f7aa1ad9a3311de5663/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQ0FBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUJBQWdBQUFBQUFBQUVBQUFBQUFBQVFBQUFBQUVBQUFBQUFBQUFBQUJJQUFBQUNBQUFBQUFBQUFBQUFBQUFRQUFJQUFBQUFBQUFBQUFFQUFBZ0FBQUFBQUFBQUFRRUFRQUFBQUFCQUFBQUFBQUFBQUFBQUFBQkFBQVFBQUlBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxMDYsImV4cCI6MTc4MjQ2NjkwNn0.PCu57f2a9M3DEOkBJfD-6cLxMb-jg67AEVgd9oq-CzI)

### 特殊用例2：字符集影响字符串转到二进制串的结果（yashan只能默认用服务端的字符集）

![image.png](https://pingcode.yasdb.com/atlas/files/public/676a8057a1ad9a3311de5669/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQ0FBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUJBQWdBQUFBQUFBQUVBQUFBQUFBQVFBQUFBQUVBQUFBQUFBQUFBQUJJQUFBQUNBQUFBQUFBQUFBQUFBQUFRQUFJQUFBQUFBQUFBQUFFQUFBZ0FBQUFBQUFBQUFRRUFRQUFBQUFCQUFBQUFBQUFBQUFBQUFBQkFBQVFBQUlBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxMDYsImV4cCI6MTc4MjQ2NjkwNn0.PCu57f2a9M3DEOkBJfD-6cLxMb-jg67AEVgd9oq-CzI)

![image.png](https://pingcode.yasdb.com/atlas/files/public/676a800ea1ad9a3311de5666/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQ0FBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUJBQWdBQUFBQUFBQUVBQUFBQUFBQVFBQUFBQUVBQUFBQUFBQUFBQUJJQUFBQUNBQUFBQUFBQUFBQUFBQUFRQUFJQUFBQUFBQUFBQUFFQUFBZ0FBQUFBQUFBQUFRRUFRQUFBQUFCQUFBQUFBQUFBQUFBQUFBQkFBQVFBQUlBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxMDYsImV4cCI6MTc4MjQ2NjkwNn0.PCu57f2a9M3DEOkBJfD-6cLxMb-jg67AEVgd9oq-CzI)



##   [2.2 CONCAT_WS](#22-json-extract)  

###   [2.2.1 语法](#221-功能点1语法)  

CONCAT_WS(separator,str1,str2,...)

###   [2.2.2 参数规格](#222-功能点2参数规格)  

|参数|参数类型|参数格式|
|---|---|---|
|strN|能够转字符类型的所有类型||


###   [2.2.3 需求详细描述](#223-需求详细描述)  

CONCAT_WS() 是 CONCAT() 的一种特殊形式，代表 Concatenate With Separator。第一个参数是其余参数的分隔符。分隔符被添加到要连接的字符串之间。分隔符可以是字符串，其余参数也可以是字符串。如果分隔符为空，则结果为空。

### 类型

类型和CONCAT一样。

有二进制则返回二进制，否则返回字符类型。数值类型转成字符类型。

### NULL

- CONCAT_WS() 不会跳过空字符串。
- 分隔符为NULL，则函数返回NULL。分隔符非NULL则会跳过分隔符后面的NULL。
- ![image.png](https://pingcode.yasdb.com/atlas/files/public/676146aaa1ad9a3311de4ecb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQ0FBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUJBQWdBQUFBQUFBQUVBQUFBQUFBQVFBQUFBQUVBQUFBQUFBQUFBQUJJQUFBQUNBQUFBQUFBQUFBQUFBQUFRQUFJQUFBQUFBQUFBQUFFQUFBZ0FBQUFBQUFBQUFRRUFRQUFBQUFCQUFBQUFBQUFBQUFBQUFBQkFBQVFBQUlBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxMDYsImV4cCI6MTc4MjQ2NjkwNn0.PCu57f2a9M3DEOkBJfD-6cLxMb-jg67AEVgd9oq-CzI)


### 长度

### 参数个数





##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

说明整个特性或子特性，在对应数据库下，调研得到的功能限制或约束。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*