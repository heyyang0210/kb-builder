Created by 徐伟, last modified on 一月 22, 2024

#   [YDBRD-16304: 支持to_date(形同'20230606'的常量字符串/表列/过程体局部变量,'yyyy-mm-dd')](#ydbrd-16304-支持to-date形同20230606的常量字符串表列过程体局部变量yyyy-mm-dd)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-15598](https://jira.yasdb.com/browse/YDBRD-15598)     / SR链接：    [https://jira.yasdb.com/browse/YDBRD-16484](https://jira.yasdb.com/browse/YDBRD-16484)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-16304/](https://jira.yasdb.com/browse/YDBRD-16304/)     SR链接：    [https://jira.yasdb.com/browse/YDBRD-16726](https://jira.yasdb.com/browse/YDBRD-16726)  

##   [1. Overview（概述）](#1-overview概述)  

to_date支持的格式符形式灵活，可以使用分隔符间隔，也可以不使用，当前按客户需求按白名单形式支持('20121210','yyyy-mm-dd')形式

##   [2. Features（功能特性）](#2-features功能特性)  

使用如下：

```
SQL&gt; select to_date('20120102','yyyy-mm-dd') from sys.dual;

TO_DATE('20120102','             
-------------------------------- 
2012-01-02 00:00:00             

1 row fetched.



```

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
static CodResult codDateFetchSplitChar(CodText* text, DateElement* elmt, CodBool* isSplitChar);


```

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 只支持fmt为yyyymmdd的格式符，其余不支持
- 原用例报错在支持该特性后会正常执行
- 现在to_date/to_timstamp在进行字符串匹配时，有无分隔符的情况都已支持
- 由于改了text转date的接口，相关函数都会受到相应影响，需要刷用例
- 部分结果都oracle会不一致，因为oracle也有自相矛盾的地方，具体见下方用例
- SR只支持YYYY、MM、DD这三个分隔符，由于分隔符匹配在每个fmt匹配调用公共代码，所以其他固定长度的fmt也可以支持SR这种形式（如：HH24/MI/SS）；对于不定长的暂不支持，结果会有问题（如：MONTH、DAY这些返回的是几月跟周几，每个月份跟日的英文字母长度不同，目前未特殊处理）


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 实现流程](#51-实现流程)  

***实现按照如下优先匹配规则实现***

1、先判断str有无分隔符

2、再判断fmt有无分隔符

3、最终根据下一个fmt要匹配的字符去str查找，如果没分隔符则根据fmt类型取str的对应长度（如：yyyy取str的长度为4），oracle目前的长度无论有无分隔符是严格匹配

4、在匹配成功后，目前只对year相关长度进行校验

eg：  **oracle报错**

```
SQL&gt; select to_date('2021-017','yyyy-mm-dd') from sys.dual;
select to_date('2021-017','yyyy-mm-dd') from sys.dual
               *
第 1 行出现错误:
ORA-01861: 文字与格式字符串不匹配


```

  


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

  


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- str跟fmt的分隔符都有时
- str有分隔符、fmt无分隔符
- str无分隔符，fmt有分隔符
- str跟fmt都无分隔符


###   [ORACLE用例表现](#oracle用例表现)  

```
SQL&gt; select to_date('20210714  .','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual;

TO_DATE('20210714.'
-------------------
2021-07-14 00:00:00

SQL&gt; select to_date('20210714     -','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual;

TO_DATE('20210714-'
-------------------
2021-07-14 00:00:00


SQL&gt; select to_date('20210714     --','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual;
select to_date('20210714     --','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual
               *
第 1 行出现错误:
ORA-01861: 文字与格式字符串不匹配


SQL&gt; select to_date('20210714-','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual;

TO_DATE('20210714-'
-------------------
2021-07-14 00:00:00


SQL&gt; select to_date('20210714 -','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual;

TO_DATE('20210714-'
-------------------
2021-07-14 00:00:00

SQL&gt; select to_date('20210714- ','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual;
select to_date('20210714- ','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual
               *
第 1 行出现错误:
ORA-01861: 文字与格式字符串不匹配


SQL&gt; select to_date('2021-0107','yyyy-mm-dd') from sys.dual;

TO_DATE('2021-0107'
-------------------
2021-01-07 00:00:00


SQL&gt; select to_date('2021-017','yyyy-mm-dd') from sys.dual;
select to_date('2021-017','yyyy-mm-dd') from sys.dual
               *
第 1 行出现错误:
ORA-01861: 文字与格式字符串不匹配



SQL&gt; select to_date('2021-01-7','yyyy-mm-dd') from sys.dual;

TO_DATE('2021-01-7'
-------------------
2021-01-07 00:00:00


```

###   [Yashan对应表现(优先找分隔符匹配)](#yashan对应表现优先找分隔符匹配)  

```
SQL&gt; select to_date('20210714  .','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual;

[1:16]YAS-00008 type convert error : literal does not match format string

SQL&gt; select to_date('20210714     -','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual;

[1:16]YAS-00008 type convert error : literal does not match format string

SQL&gt; select to_date('20210714     --','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual;

[1:16]YAS-00008 type convert error : literal does not match format string

SQL&gt; select to_date('20210714-','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual;

[1:16]YAS-00008 type convert error : literal does not match format string

SQL&gt; select to_date('20210714 -','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual;

[1:16]YAS-00008 type convert error : literal does not match format string

SQL&gt; select to_date('20210714- ','yyyy-mm-dd a.m. hh:mi:ss') from sys.dual;

[1:16]YAS-00008 type convert error : literal does not match format string


SQL&gt; select to_date('2021-0107','yyyy-mm-dd') from sys.dual;

TO_DATE('2021-0107',             
-------------------------------- 
2021-01-07 00:00:00             

1 row fetched.

SQL&gt; select to_date('2021-017','yyyy-mm-dd') from sys.dual;

TO_DATE('2021-017','             
-------------------------------- 
2021-01-07 00:00:00             

1 row fetched.

SQL&gt; select to_date('2021-01-7','yyyy-mm-dd') from sys.dual;

TO_DATE('2021-01-7',             
-------------------------------- 
2021-01-07 00:00:00             

1 row fetched.



```

  


##   [7. Workload（工作量）](#7-workload工作量)  

待刷新

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

- oracle支持中文情况，目前看在nls_date_language为中文时，支持如下中文，MON：支持输入'月’；DAY/DY 支持输入‘星期’；am/pm 支持输入‘上午’、‘下午 ’


待刷新

  


  


  


  
