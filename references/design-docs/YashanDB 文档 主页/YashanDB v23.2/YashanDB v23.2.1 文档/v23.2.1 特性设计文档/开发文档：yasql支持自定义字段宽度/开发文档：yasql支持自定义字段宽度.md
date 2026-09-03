Created by 刘亮杰, last modified on 一月 17, 2024

# yasql支持  自定义字段宽度

SR：

  [YDBRD-22422](https://jira.yasdb.com/browse/YDBRD-22422?src=confmacro)    -  【yasql】支持自定义字符字段宽度  完成

  [YDBRD-25042](https://jira.yasdb.com/browse/YDBRD-25042?src=confmacro)    -  【yasql】支持显示字段宽度控制  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#1-overview%E6%A6%82%E8%BF%B0)  

需求范围：

单机  ,   分布式  ,   集群

需求来源：    
  数研所    
    
  需求场景：    
  数研所反馈yasql输出无法像oracle一样控制宽度，格式混乱。    
    
  需求描述：    
  yasql支持显示字段宽度设置（col xx format xx等）

  


ORACLE文档：

  [COLUMN (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqpug/COLUMN.html#GUID-643B665F-B134-4A0B-88F7-10400D6D199E)  

一个易于理解的文档：

  [oracle--sqlplus格式化输出_51CTO博客_oracle sqlplus命令](https://blog.51cto.com/kingle/4919864)  

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

#### 语法

（1）COL[UMN]   column   |   expr

根据列名指定要作用的列。

标识column命令所引用的SQL SELECT命令中的数据项（通常是列的名称）。(大小写不敏感）  （无通配符）

若在COLUMN命令中使用表达式，则必须输入与SELECT命令中显示的  完全相同  的表达式。例如，如果SELECT命令中的表达式是a+b，则不能在COLUMN命令中使用b+a或（a+b）来引用SELECT命令的表达式。

如果从不同的表中选择具有  相同名称  的列，则该列名的COLUMN命令将  应用于这两列  。

（2）FOR[MAT] format

这里的format必须是文本常量，例如A10或9999.99。  a加空格？报错；a指定的范围？为0报错；和Oracle对齐

##### 字符列

CHAR、NCHAR、VARCHAR2（VARCHAR）和NVARCHAR2（NCHAR VARYING）列的默认宽度是数据库中列的宽度。    
  要将数据类型的宽度更改为n，使用FORMAT An。（A代表字母）如果指定的宽度短于列标题，SQL*Plus会截断标题。如果指定的宽度短于字符串长度，由于缺少基础能力，  默认截断（truncate）列中的元素。

拦截其他非a，报错

调研oracle中文字符截断情况（不同字符集）

##### 数值列

对于数值列，COLUMN FORMAT设置的优先级高于SET NUMWIDTH设置。

To change a       `NUMBER`       column's width, use       `FORMAT`       followed by an element as specified in       [Table 13-1](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqpug/COLUMN.html#GUID-643B665F-B134-4A0B-88F7-10400D6D199E__BABBDHHE)    .

|Element|Examples|Description|
|---|---|---|
|. (period)|99.99|Displays a period (decimal point) to separate the integral and fractional parts of a number.|
|9|9999|Displays a value with the number of digits specified by the number of 9s. Value has a leading space if positive, a leading minus sign if negative. Blanks are displayed for leading zeroes. A zero (0) is displayed for a value of zero.|
|EEEE|9.999EEEE|Displays value in scientific notation (format must contain exactly four "E"s).|


示例：

```

SQL&gt; insert into t_1 values('liuliangjie',123456.19);

已创建 1 行。

SQL&gt; select * from t_1;

COL1			   COL2
-------------------- ----------
liuliangjie	      123456.19

SQL&gt; col col1 format a11;
SQL&gt; select * from t_1;

COL1		  COL2
----------- ----------
liuliangjie  123456.19

SQL&gt; col col2 format 9999999999.99;
SQL&gt; select * from t_1;

COL1		      COL2
----------- --------------
liuliangjie	 123456.19

SQL&gt; col col2 format 9.9999999EEEE;
SQL&gt; select * from t_2;

COL1		       COL2
----------- ---------------
liuliangjie   1.2345619E+05

SQL&gt; 



```

（3）显示和清除

##### CLEAR

重置或擦除指定选项的当前值或设置。

通过CL  [  EAR  ]   COL  [  UMNS  ]  将column命令设置的列显示属性重置为所有列的默认设置。要重置单列的显示属性，请使用column命令的CLEAR子句。

示例

```
//显示所有列的显示属性值
SQL&gt; col
COLUMN	 col2 ON
FORMAT	 9.9999999EEEE

COLUMN	 col1 ON
FORMAT	 a11

//显示单列的显示属性值
SQL&gt; col col1
COLUMN	 col1 ON
FORMAT	 a11

//将单列的显示属性值清除
SQL&gt; col col2 clear
SQL&gt; col

COLUMN	 col1 ON
FORMAT	 a11

//将所有列的显示属性值清除
SQL&gt; CLEAR COLUMNS


```

匹配情况：

  


  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#3-interfaces%E6%8E%A5%E5%8F%A3)  

  [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1、指令缩写格式

2、format数值类型中用法较多，仅支持如下三种。

|Element|Examples|Description|
|---|---|---|
|. (period)|99.99|Displays a period (decimal point) to separate the integral and fractional parts of a number.|
|9|9999|Displays a value with the number of digits specified by the number of 9s. Value has a leading space if positive, a leading minus sign if negative. Blanks are displayed for leading zeroes. A zero (0) is displayed for a value of zero.|
|EEEE|9.999EEEE|Displays value in scientific notation (format must contain exactly four "E"s).|


  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

建立一个List* gExecEnv.column来储存列的显示属性值，每次通过col column_name来在这个列表中插入属性。

在select返回时查询gExecEnv.column，匹配字符串，如果选择的column在list里面就按设置的格式输出。

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  
