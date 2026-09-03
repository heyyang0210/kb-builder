  [https://pingcode.yasdb.com/pjm/items/67652db3622069d46dfa8bbf?](https://pingcode.yasdb.com/pjm/items/67652db3622069d46dfa8bbf?)  

#YDBRD-36766 支持outline lob字段长度的计算

# 1 简介



## 1.1 目的

本文档对YashanDB的 支持outline lob字段长度的计算特性进行设计，明确主要的数据结构和主要处理过程，作为后续编码阶段的输入和编码、测试人员的指导。



## 1.2 范围

部署模式：单机、分布式

表类型：列表

语法支持范围：

||BLOB|CLOB|NCLOB|JSON|
|---|---|---|---|---|
|LENGTH|支持|支持|-|-|
|CHAR_LENGTH|支持|支持|-|-|
|CHARCTER_LENGTH|支持|支持|-|-|
|LENGTHB|支持|支持|-|-|
|OCTET_LENGTH|支持|支持|-|-|
|BIT_LENGTH|-|-|-|-|
|LENGTH2|-|-|-|-|
|DBMS_LOB.GET_LENGTH|部分支持|部分支持|-|-|
|DBMS_LOB.GETLENGTH|部分支持|部分支持|-|-|
|JDBC-length()|支持|支持|-|-|
|C驱动：  [yacLobGetLength](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/C-Language-Family-Drivers/C-Driver/C-Driver-Interfaces/LOB-Functions/yacLobGetLength.html)  |支持|支持|-|-|


# 2 特性需求概述

当前崖山对outline lob字段长度计算时报错unsupported feature，本需求要支持outline lob字段长度的计算，比如使用length()函数对outline lob字段进行计算



# 3 需求场景分析



## 3.1 需求来源

智慧工会&电子处方等客户有使用，但不强依赖



# 4 特性设计



## 4.1 总体方案

### 4.1.1 单机

原始方案在transform_func阶段，对于CLOB/BLOB转成string进行计算，当前方案不进行转换，给对应的表达式实现相应的长度计算。

```
FuncId::Length | FuncId::CharLength | FuncId::CharacterLength => {
    check_args_num("Length", arg_exprs.len(), 1)?;
    let arg_type = get_unary_type(arg_data_types[0], context.root_data_type());
    match arg_type {
        AnDataType::Json => Ok(try_new_box_expr(CharLength::new(
            arg_exprs[0].try_clone()?.into(),
        ))?),
        AnDataType::Blob => {
            Ok(try_new_box_expr(ByteLength::new(
                arg_exprs[0].try_clone()?.into(),
            ))?)
        }
        _ => {
            Ok(try_new_box_expr(CharLength::new(
                arg_exprs[0].try_clone()?.into(),
            ))?)
        }
    }
}

FuncId::LengthB | FuncId::OctetLength => {
    check_args_num("LengthB", arg_exprs.len(), 1)?;
    let arg_type = get_unary_type(arg_data_types[0], context.root_data_type());
    let input = if matches!(arg_type, AnDataType::Json | AnDataType::Clob | AnDataType::Blob) {
        arg_exprs[0].try_clone()?.into()
    } else {
        convert_to_string_wrap(arg_exprs[0].try_clone()?, arg_type, context)?
    };
    Ok(try_new_box_expr(ByteLength::new(input))?)
}

impl<C: Charset + Sync> UnaryScalarEvaluator<ClobType> for CharLengthScalar<C> {
    type Output = Int64Type;
    type Error = Error;

    fn output_type(&self) -> Self::Output {
        Int64Type
    }

    fn evaluate<'a>(
        &self,
        source: <ClobType as Type>::Native<'a>,
    ) -> std::result::Result<<Int64Type as Type>::Native<'a>, Self::Error> {
        let char_size = reader.read_outline_clob_char_size(source)?;
        return Ok(char_size as i64)
    }
}
```

### 4.1.2 分布式

1. 正常读的场景，length会下推，无需跨节点读，实现方案和单机相同


![image.png](https://pingcode.yasdb.com/atlas/files/public/678f95d2d6fcabebff225704/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFFQUlBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDU0NzYsImV4cCI6MTc4MjM1NjI3Nn0.i4TDHAB2nE72VuLMSCKIZNLgfKA4J98yHq1vZotJP1Y)

1. 需要跨节点读的场景：
    1. 通过LOB API，读长度时需要先判断读的节点，将lob length请求转发到指定节点读（已支持）。
    1. LOB高级包，分布式不支持（不涉及）。
    1. 跨节点计算的场景（暂不支持大LOB计算）
    1. 通过函数读lob长度的场景，优化器不保证全部下推，可能存在需要跨节点读的场景


# 5 资料设计

资料中放开关于不支持行外lob长度的相关描述



# 6 自测用例设计

|编号|场景描述|预期结果|
|---|---|---|
|1|LSC\TAC表CLOB小于32000时读取字符长度和字节长度（单机、分布式）|正常读且结果正确|
|2|LSC\TAC表CLOB小于32000指定行外存储时读取字符长度和字节长度（单机、分布式）|正常读且结果正确|
|3|LSC\TAC表CLOB大于32000时读取字符长度和字节长度（单机、分布式）|正常读且结果正确|
|4|LSC\TAC表BLOB小于32000时读取字符长度和字节长度（单机、分布式）|正常读且结果正确|
|5|LSC\TAC表BLOB小于32000指定行外存储时读取字符长度和字节长度（单机、分布式）|正常读且结果正确|
|6|LSC\TAC表BLOB大于32000时读取字符长度和字节长度（单机、分布式）|正常读且结果正确|
|7|驱动分别读取CLOB\BLOB行内以及行外的长度|正常读且结果正确|
|8|单机通过高级包读CLOB\BLOB长度|正常读且结果正确|
|9|分布式通过高级包读CLOB\BLOB长度|不支持|
|10|BIT_LENGTH、LENGTH2读lob长度|不支持|


