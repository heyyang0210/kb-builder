Created by 鄢红亮, last modified on 十一月 13, 2023

  [](https://jira.yasdb.com/browse/YDBRD-13105)      [YDBRD-13105](https://jira.yasdb.com/browse/YDBRD-13105?src=confmacro)    -  【列存计算】优化decimal和整形的计算  完成

# **1. 概述**

1.当decimal的scale为0时，整数转成了decimal就可以直接运算 ,如果评估出来不溢出，可以用uncheck接口进行计算。

2.当decimal的scale不为0时，需要先转成scale一样的decimal，如果能够用unchecked方法的，要用uncheck方法实现。

对于非溢出的场景，表达式性能提升要在50%以上。

# **2. 需求分析**

整数可以看成scale为0的decimal

|原始类型|等价表示|
|:---|:---|
|tinyint|number(3, 0)|
|smallint|number(5, 0)|
|int|number(10, 0)|
|bigint|number(19, 0)|


- 加法、减法


|功能|设计表现|设计说明|
|:---|:---|:---|
|两个参数的scale相等，最大precision不是38|使用uncheck接口计算（decimal之间运算之前已经做了，这个特性会优化整数和decimal之间运算）|没有超过10^38的范围，不会溢出|
|两个参数的scale相等，最大precision为38|使用check接口计算|可能溢出|
|两个参数的scale不等|参数的scale按低位对齐，之后按照scale相等判断（这个特性适配两个decimal，不溢出情况不用都转成decimal）|行为解释说明|


- 乘法


|功能|设计表现|设计说明|
|:---|:---|:---|
|scale相加在-126和130之间，precision相加超过当前native的最大precision，但是不超过38|使用uncheck接口计算（同上）|没有超过10^38的范围，不会溢出|
|precision相加超过38|使用check接口计算|可能溢出|
|scale相加不在-126和130之间|使用check接口计算|可能溢出|


**  
**

**  
**

# **3. 测试设计方法**

**主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计**

**通过打开来验证性能**

#### set autotrace on; 

#### set timing on; 

  


**3.1、基本功能测试**

|【列存计算】优化decimal和整形的计算|decimal|Precision和Scale规格|1<=p<=9，指定 s|Decimal32|  
|
|:---|:---|:---|:---|:---|:---|
||||10<=p<=18，指定 s|Decimal64|  
|
||||19<=p<=38，指定 s|Decimal128|  
|
||||不指定p s|Decimal|  
|
||||超出 p s 范围|报错|  
|
|||优化|当decimal的scale为0时，整数转成了decimal就可以直接运算 ,如果评估出来不溢出，可以用uncheck接口进行计算。|Scale为0，Precision为1、3、5、9、10、18、19、38非溢出场景|  
|
||||当decimal的scale不为0时，需要先转成scale一样的decimal，如果能够用unchecked方法的，要用uncheck方法实现。|Scale不为0，Precision为1、9、10、18、38|  
|
||||对于非溢出的场景，表达式性能提升要在50%以上。|  
|  
|
||与Decimal32/64/128计算|类型|整形|BIGINT|number(3, 0)|
|||||TINYINT|number(5, 0)|
|||||SMALLINT|number(10, 0)|
|||||INT|number(19, 0)|
||||decimal|Decima、Decimal32/64/128|  
|
|||||边界值|  
|
|||函数|sum|  
|  
|
||||avg|  
|  
|
||||POW POWER|  
|  
|
||在SQL中的位置|select|  
|  
|  
|
|||where|  
|  
|  
|
|||limit|  
|  
|  
|
|||group by having|  
|  
|  
|
|||order by|  
|  
|  
|
||计算方式|加法|  
|  
|  
|
|||减法|  
|  
|  
|
|||加法和减法|  
|  
|  
|
|||减法和乘法|  
|  
|  
|
|||乘法和减法|  
|  
|  
|
|||加法减法乘法|  
|  
|  
|
|||乘法|scale相加在-126和130之间，precision相加超过当前native的最大precision，但是不超过38 使用uncheck接口计算 没有超过10^38的范围，不会溢出|  
|  
|
||||precision相加超过38 使用check接口计算 可能溢出|  
|  
|
||||scale相加不在-126和130之间 使用check接口计算 可能溢出|  
|  
|
||场景|正的溢出，负的溢出|  
|  
|  
|
|||非溢出|  
|  
|  
|
|||Precision溢出|  
|  
|  
|
||部署方式|单机|lsc|  
|  
|
||||tac|  
|  
|
|||分布式|lsc|  
|  
|
||||tac|  
|  
|
||大数据量进行计算,与之前的性能进行对比|基于tpch数据，主要是加减法|  
|  
|  
|


  


# **4. 详细测试设计**



# **5. 测试用例**

测试设计细化后的文本用例

详见：    [standalone/testcase/function5/test_sdv_decimal_Optimize · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function5/test_sdv_decimal_Optimize)  

  


# **6. 测试框架设计**

1. **本次测试采用Guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。**


# **7. 测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机,分布式|
