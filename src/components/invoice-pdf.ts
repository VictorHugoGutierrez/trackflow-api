import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 12 },
  section: { margin: 10, padding: 10 },
  title: { fontSize: 24, marginBottom: 10 },
});

export const InvoicePdfDocument = ({ tenantName, clientName, monthRef, durationSeconds, amountCents }: any) =>
  React.createElement(Document, null,
    React.createElement(Page, { style: styles.page },
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.title }, "TrackFlow Fatura"),
        React.createElement(Text, null, "Empresa: ", tenantName),
        React.createElement(Text, null, "Cliente: ", clientName),
        React.createElement(Text, null, "Período: ", monthRef)
      )
    )
  );
