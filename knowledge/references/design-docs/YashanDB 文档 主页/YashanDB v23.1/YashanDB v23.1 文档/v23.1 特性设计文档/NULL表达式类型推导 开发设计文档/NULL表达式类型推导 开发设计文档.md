Created by 陈秋富, last modified on 一月 19, 2024

# 归档链接：    [NULL表达式类型推导 开发设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133566240)  

#   [YDBRD-13782 : NULL ExprNode Design（NULL表达式 方案设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

SR链接：    [[YDBRD-13782] NULL表达式的数据类型指定为DTYPE_UNKNOWN - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13782)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#1-overview%E6%A6%82%E8%BF%B0)  

本设计方案主要是修正yasdb内部关于NULL表达式的处理。主要去掉verify阶段对于常量null表达式的类型推导。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

（1）当前涉及到null表达式的有两种，一种是输入null表达式，另一种是空串转换而来的null表达式。（和oracle对齐，目前认为空串也是null，但是后续不好说。）此时null表达式的DTYPE_UNKNOW类型的。

（2）绑定参数传入null或者空串，对于这种场景下，输入的null表达式是带具体类型的。

（3）涉及到行存和列存的执行。

```
（1）SQL语法直接输入null或者空串
select null from dual;
select '' from dual;

（2）通过绑定参数方式输入null或者空串
declare
    vc_name integer;
begin
	vc_name := null;
    execute immediate 'select id,name from tbl_job where id= :1' using vc_name;
    dbms_output.put_line(vc_name);
end;
/
```

  


  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#3-interfaces%E6%8E%A5%E5%8F%A3)  

（1）去掉verify阶段adjustUnknowExprNode接口。

（2）去掉conclude阶段的adjustNullType接口。

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

（1）常量null以及空串都被认为是null表达式，类型是DTYPE_UNKNOW的。

~~（2）DTYPE_UNKNOW类型的内容做四则运算的时候，输出的也是DTYPE_UNKNOW的。（这块和oracle的输出结果有些差异。）~~

（2）常量null的DTYPE_UNKNOW不会扩散。

（3）null参与的谓词情况，可以参考    [NULL值处理 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=57836970)    。

（4）驱动接口传入的null都是带类型的，目前应该没有例外的情况。

（5）关于null表达式位于投影列上时，返回类型的问题。此时由于verify阶段后，会将投影列类型返回，null表达式返回的都是varchar类型的。（兜底流程造成的）。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#51-architecture%E6%9E%B6%E6%9E%84)  

|涉及到null表达式处理的阶段||原特性实现|新特性实现|
|---|---|---|---|
|lexer、parse阶段||1、在parse阶段识别到NULL标识符，在表达式树上增加表达式节点，类型为EXPR_CONST，节点value类型为DTYPE_INTEGER，value值为SYSVAR_NULL；,2、对于null     是lexer解析识别成关键字ANL_TOKEN_NULL，然后parse转换成 SYSVAR_NULL;,3、对于空串''  是读取成字符串，addStringWord时候转换SYSVAR_NULL。|同原特性，未改变。|
|verify阶段||1、  verifySysVar 将SYSVAR_NULL转换成 EXPR_CONST、DTYPE_UNKNOW并且isNull = TRUE。,2、通过adjustUnknowExprNode接口将涉及到null常量表达式的部分推导成预定的类型。,3、verifyBuiltinMethod接口处会收集是否涉及null参数，adjustExprNull将node优化成null表达式。涉及到 BIF_TRAIT_NULL_INS 的flag作用。|1、未变化。,2、去掉adjustUnknowExprNode接口，此时常量表达式仍为,EXPR_CONST、DTYPE_UNKNOW并且isNull = COD_TURE。,3、未变化。,4、关注加入null后的函数等流程的返回值类型。|
|返回投影列类型接口,stmt->sender→sendPrepResult||1、位于投影列上的null表达式会被赋予类型，所以返回给客户端的也有一定的类型。|1、由于null表达式被推导成DTYPE_UNKNOW，所以最后返回吐出兜底的是DTYPE_VARCHAR类型的。|
|exec阶段|load param阶段|  
|1、传入空串或者null表达式的时候需要处理。将字符串长度为0的空串的isNull标志位置于 COD_TURE。|
||conclude阶段|1、加入adjustNullType接口，为了将null表达式重新推导成正确的类型。|1、去掉adjustNullType接口。|
||行存执行|1、execConstExpr接口将传入的null表达式处理。,2、execParamExpr接口处理通过绑定参数传入的null表达式。|同原特性，未改变。|
||列存执行|1、通过exprNode上面挂着的dataType类型，将null表达式转换成对应的none。|1、在发现传入的是null表达式的时候，需要自推导成某个类型。目前是假设给个char(1)类型。,2、自推导完后需要考虑是否会被通用处理函数部分拦截的情况。,3、排查每个函数使用场景，看是否考虑了null表达式的处理。|


###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

~~1、关于null表达式位于投影列上时，返回类型的问题。此时由于verify阶段后，会将投影列类型返回，null表达式返回的都是varchar类型的。（兜底流程造成的）。~~

~~2、调研过程中发现的四则运算的问题。是否考虑都变成DTYPE_UNKNOW的。~~

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#54-dfx%E8%AE%BE%E8%AE%A1)  

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#55-%E5%85%B6%E4%BB%96)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

（1）直接传入null或者空串，查看输出的结果。

（2）绑定参数传入null或者空串，查看输出的结果。

（3）驱动接口、plsql传入null。

（4）关注行存和列存表。分布式的表现和列存表现应该差不多。

（5）关注输出的类型。

（6）关注直接传入null或者通过绑定参数传入null，参与四则运算、谓词过滤。

（7）关注直接传入null或者通过绑定参数传入null，参与具体函数的参数。

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

  [NULL表达式的数据类型推导 调研文档 - 陈秋富 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109583306)  

  [DTYPE_UNKNOWN类型Verify规则定义 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=59611541)  

  [NULL值处理 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=57836970)  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=95100144#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,2023-5-16 ,参会人：陈秋富、胡威振、罗继鸿、黄靖东、刘清萍,1、函数内部传入null，推导到上层函数时候还是unknow吗？四则运算，确认Unknow是否会扩散。    
  2、列存默认将null表达式转换成char类型。    
  3、列存参考adjustUnknowExprNode的实现。    
  4、列存关注默认不能推导成char类型的函数，如nvl函数，需要根据其他参数重新推导。,Posted by chenqiufu at 五月 16, 2023 14:52|
|---|
|  [](null)  ,1、null表达式引入的unknow类型不会扩散，只作用于当前的函数参数内。,Posted by chenqiufu at 五月 17, 2023 09:52|
