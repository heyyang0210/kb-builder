Created by 徐伟 on 七月 08, 2023

#   [YDBRD-14149: DATE_FORMAT支持YYYYMMDD](#ydbrd-14149-date-format支持yyyymmdd)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-14000](https://jira.yasdb.com/browse/YDBRD-14000)     / SR链接：    [https://jira.yasdb.com/browse/YDBRD-14149](https://jira.yasdb.com/browse/YDBRD-14149)    IR链接：    [https://jira.yasdb.com/browse/YDBRD-11204](https://jira.yasdb.com/browse/YDBRD-11204)     / SR链接：    [https://jira.yasdb.com/browse/YDBRD-14166](https://jira.yasdb.com/browse/YDBRD-14166)  

##   [1. Overview（概述）](#1-overview概述)  

to_date支持的格式符形式灵活，可以使用分隔符间隔，也可以不使用，当前按客户需求按白名单形式支持yyyymmdd该格式符。

##   [2. Features（功能特性）](#2-features功能特性)  

使用如下：

```
SQL&gt; select to_date('20120111','yyyymmdd') from sys.dual;

TO_DATE('20120111','             
-------------------------------- 
2012-01-11 00:00:00    

SQL&gt; select to_date('2012131','yyyymmdd') from sys.dual;

[1:16]YAS-00008 type convert error : not a valid month


```

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
static inline CodUint32 codDateCalcFmtLen(CodUint32 textLen, DateElement* elmt);

```

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 只支持fmt为yyyymmdd的格式符，其余不支持
- 对于原用例会导致报错信息变更（预期，直接刷用例）


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

  


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

  


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

  


##   [7. Workload（工作量）](#7-workload工作量)  

待刷新

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

- oracle形式灵活，支持各种格式符之间不带分隔符，比如yyyymmddhh24miss
- oracle的src字符串的空格格式符在匹配时可以被忽略，其余必须对应位置有对应格式符出现，如 to_date(2012  1201,yyyymmdd)可以执行，但是to_date(2012,1201,yyyymmdd)报错oracle的fmt中的分隔符可以不管，无需在src字符串中出现也可以匹配，如to_date(20121201,yyyy-mm,dd)可以执行
- oracle支持中文情况，目前看在nls_date_language为中文时，支持如下中文，MON：支持输入'月’；DAY/DY 支持输入‘星期’；am/pm 支持输入‘上午’、‘下午 ’


待刷新

  


  


  


  
