Created by 赵忠源, last modified on 八月 31, 2023

#   [YDBRD-18922: SOUNDEX Design](#ydbrd-18922-soundex-design)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-18922](https://jira.yasdb.com/browse/YDBRD-18922)  

##   [1. Overview（概述）](#1-overview概述)  

Soundex是一种语音算法，用于按英语发音对名称进行索引。目标是将同音词编码为相同的表示形式，以支持英文模糊音匹配。

SOUNDEX Research    [https://conf.yasdb.com/pages/viewpage.action?pageId=124256555](https://conf.yasdb.com/pages/viewpage.action?pageId=124256555)  

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 功能](#21-功能)  

SOUNDEX对输入字符串处理返回用经典soundex形式表示的字符串char，用于表示英文发音下单词的一种特殊缩略。该函数可以在查询（where）的子句中使用，也可以作为搜索表达式中的条件。

SOUNDEX算法-wiki百科    [https://en.wikipedia.org/wiki/Soundex](https://en.wikipedia.org/wiki/Soundex)  

Soundex 编码由一个字母后跟三个数字组成：该字母是text的第一个字母，数字通过下面规则对其余辅音进行编码。

将辅音替换为数字，如下所示（在第一个字母之后）：    
  **b、f、p、v → 1**    
  **c、g、j、k、q、s、x、z → 2**    
  **d, t → 3**    
  **l → 4**    
  **m，n → 5**    
  **r → 6**

保存第一个字母。把所有出现的 a、e、i、o、u、y、h、w替换成0

将所有辅音（包括第一个字母）替换为上面表中的数字。

将所有相邻的相同数字替换为一位数字，然后删除所有零 (0) 数字

如果保存的字母的数字与结果的第一位数字相同，则删除该数字（保留字母）。

如果单词中的字母太少而无法分配三个数字，则在后面加0，直到出现三个数字。如果有四个或更多数字，则仅保留前三个。

SOUNDEX主要用于比较拼写不同但英语发音相似的单词，仅支持英文匹配，对于中文/标点符号/数字等除英文字符外的会直接忽略

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
CodResult codGetPreSoundex(CodText *currText, CodText *preSoundex)    
CodResult codGetSoundex(CodText *currText, CodText *resText)  
CodResult bifVerifySoundex(AnlVerifier* vrfr, ExprNode* node)  
CodResult bifConcludeSoundex(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)  
CodResult bifExecSoundex(AnlStmt* stmt, ExprNode* func, Variant* retValue)  

```

codGetPreSoundex中对原始字符串做初步处理，筛除除英文字符以外的字符，截取第一个英文字符往后的有效字符串

codGetSoundex中对presoundex处理后的字符串计算Soundex值，并返回正确的类型

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

###   [4.1 参数规格](#41-参数规格)  

SOUNDEX主要用于比较拼写不同但英语发音相似的单词，仅支持英文匹配，对于中文/标点符号/数字会直接忽略

入参Char可以为CHAR/VARCHAR/NCHAR/NVARCHAR,不直接支持CLOB，但可支持隐式转换传入的字符串类型

出参Result返回的是4字节的对应类型或NULL,详见下表，与输入类型对应。

JSON类型yasdb与Oracle输出不同，原因：yasdb对json类型键值对排序，使转换对应字符串字符串不同而出现差异。

|**入参Char**|**bool**|**int**|**number**|**smallint**|**bigint**|**float**|**double**|**date**|**time**|**timestamp**|**CHAR**|**VARCHAR**|**NCHAR**|**NVARCHAR**|**CLOB**|**BLOB**|**NCLOB**|**RAW**|JSON|
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
|**出参Result**|**NULL**|**NULL**|**NULL**|**NULL**|**NULL**|**NULL**|**NULL**|**NULL**|**NULL**|**NULL**|**VARCHAR**|**VARCHAR**|**NVARCHAR**|**NVARCHAR**|**VARCHAR**|**VARCHAR**|**NVARCHAR**|**VARCHAR**|**VARCHAR**|


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Data Structures & Flow（数据结构与流程）](#51-data-structures--flow数据结构与流程)  

语法图

![](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/img/soundex.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkyNjYsImV4cCI6MTc4MjMxMDA2Nn0.VC1J-Tb-iWkmxuGK0b46VP0TA0FANWoR9D3R4aVtQ5E)

主要数据结构

```
CodChar soundexValue[256] = {  
            ['A'] = '0', ['B'] = '1', ['C'] = '2', ['D'] = '3', ['E'] = '0', ['F'] = '1', ['G'] = '2', ['H'] = '0',  
            ['I'] = '0', ['J'] = '2', ['K'] = '2', ['L'] = '4', ['M'] = '5', ['N'] = '5', ['O'] = '0', ['P'] = '1',  
            ['Q'] = '2', ['R'] = '6', ['S'] = '2', ['T'] = '3', ['U'] = '0', ['V'] = '1', ['W'] = '0', ['X'] = '2',  
            ['Y'] = '0', ['Z'] = '2'
};  

```

快速查找每个字符对应的Soundex值

####   [5.1.1 工作流程](#511-工作流程)  

Oracle与Postgressql差异见调研文档

#####   [Oracle](#oracle)  

codGetPreSoundex

1.遍历字符串，将原字符串中所有非英文字符全置为0

2.截取第一个英文字符往后的有效字符串

codGetSoundex

1.将英文字符按soundex规则转为对应数值

2.保留相邻连续相同的数的第一位

3.去掉字符串中所有的0

4.截取前4位，不足则补0

#####   [Postgressql](#postgressql)  

codGetPreSoundex

1.遍历字符串，将原字符串中所有非英文字符全置为0 （数字全部保留原值）

2.截取第一个英文字符往后的有效字符串

codGetSoundex

1.将英文字符按soundex规则转为对应数值

2.保留相邻连续相同的数的第一位

3.去掉字符串中所有的0和原数字位

4.截取前4位，不足则补0

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
SELECT SOUNDEX('') from dual;  
SELECT SOUNDEX(NULL) from dual;  
SELECT SOUNDEX(' ') from dual;  
SELECT SOUNDEX('史密斯') from dual;  
SELECT SOUNDEX('12344321') from dual;  

SELECT SOUNDEX('AAAAAA') from dual;  
SELECT SOUNDEX('SSSSSS') from dual;  
SELECT SOUNDEX('SSHS') from dual;  
SELECT SOUNDEX('SSAA') from dual;  
SELECT SOUNDEX('Sr111Sr') from dual;  
SELECT SOUNDEX('Sr一一Sr') from dual;  
SELECT SOUNDEX('Sr,.,Sr') from dual;  
SELECT SOUNDEX('SRHR') from dual;  
SELECT SOUNDEX('Smnhmnlls') from dual;  
SELECT SOUNDEX('mn') from dual;  
SELECT SOUNDEX('SMYTHE') from dual;  
SELECT SOUNDEX('SMITH') from dual;  


```

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


  


## Comments:

|  [](null)  ,1.对boolean类型取SOUNDEX无意义，返回 NULL,2.补充json类型测试；,3.soundex值计算流程上与oracle对齐,4.测试输入长度极限,5.修改后8月底转测,Posted by zhaozhongyuan at 八月 31, 2023 14:52|
|---|
